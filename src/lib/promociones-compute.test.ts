import { describe, it, expect } from 'vitest'
import {
  diaSemanaDeFecha,
  parsePromocionBody,
  parseUsoBody,
  toPromocionResponse,
  consumoAutomatico,
  medioCoincide,
  vigenteEnMes,
  progresoPromocion,
  totalesPromociones,
  promosDelDia,
  semanaPromos,
  ordenarPorDisponible,
} from './promociones-compute'

const bodyOk = (over: Record<string, any> = {}) => ({
  lugar: '  Carrefour ',
  porcentaje: 20,
  tope_mensual: 10000,
  dias: [4, 2, 2],
  tarjeta_ids: [1, 2],
  efectivo: false,
  ...over,
})

describe('diaSemanaDeFecha', () => {
  it('lunes = 0 … domingo = 6', () => {
    expect(diaSemanaDeFecha('2026-10-26')).toBe(0) // lunes
    expect(diaSemanaDeFecha('2026-10-28')).toBe(2) // miércoles
    expect(diaSemanaDeFecha('2026-11-01')).toBe(6) // domingo
  })

  it('no corre de día por timezone (último/primer día del mes)', () => {
    expect(diaSemanaDeFecha('2026-10-31')).toBe(5) // sábado
    expect(diaSemanaDeFecha('2026-11-01')).toBe(6)
  })

  it('null si la fecha es inválida', () => {
    expect(diaSemanaDeFecha('26/10/2026')).toBeNull()
    expect(diaSemanaDeFecha(undefined)).toBeNull()
  })
})

describe('parsePromocionBody', () => {
  it('normaliza lugar, ordena y deduplica días y tarjetas', () => {
    expect(parsePromocionBody(bodyOk({ tarjeta_ids: [2, 1, 2] }))).toEqual({
      lugar: 'Carrefour',
      conceptoId: null,
      porcentaje: 20,
      topeMensual: 10000,
      dias: [2, 4],
      tarjetaIds: [2, 1],
      efectivo: false,
      activa: true,
      notas: null,
      vigenteDesde: null,
      vigenteHasta: null,
    })
  })

  it('acepta sólo efectivo (sin tarjetas) y concepto vinculado', () => {
    const r = parsePromocionBody(bodyOk({ tarjeta_ids: [], efectivo: true, concepto_id: 7 }))
    expect(r).toMatchObject({ tarjetaIds: [], efectivo: true, conceptoId: 7 })
  })

  it.each([
    ['sin lugar', { lugar: '  ' }],
    ['porcentaje 0', { porcentaje: 0 }],
    ['porcentaje > 100', { porcentaje: 101 }],
    ['tope 0', { tope_mensual: 0 }],
    ['tope negativo', { tope_mensual: -5 }],
    ['sin días', { dias: [] }],
    ['día fuera de rango', { dias: [7] }],
    ['día no entero', { dias: [1.5] }],
    ['sin tarjetas ni efectivo', { tarjeta_ids: [], efectivo: false }],
    ['tarjeta inválida', { tarjeta_ids: [0] }],
    ['concepto inválido', { concepto_id: -1 }],
    ['vigente_desde inválida', { vigente_desde: '15/10/2026' }],
    ['vigente_hasta inválida', { vigente_hasta: 'mañana' }],
    ['vigencia invertida', { vigente_desde: '2026-10-20', vigente_hasta: '2026-10-10' }],
  ])('rechaza %s', (_n, over) => {
    expect(parsePromocionBody(bodyOk(over))).toBeNull()
  })

  it('rechaza un body que no es objeto', () => {
    expect(parsePromocionBody(null)).toBeNull()
  })

  it('acepta vigencia con uno o los dos extremos (vacío = sin límite)', () => {
    expect(parsePromocionBody(bodyOk({ vigente_desde: '2026-10-15' }))).toMatchObject({ vigenteDesde: '2026-10-15', vigenteHasta: null })
    expect(parsePromocionBody(bodyOk({ vigente_desde: '', vigente_hasta: '2026-12-31' }))).toMatchObject({ vigenteDesde: null, vigenteHasta: '2026-12-31' })
    expect(parsePromocionBody(bodyOk({ vigente_desde: '2026-10-15', vigente_hasta: '2026-10-15' }))).not.toBeNull()
  })

  it('activa: false se respeta; el resto es true', () => {
    expect(parsePromocionBody(bodyOk({ activa: false }))?.activa).toBe(false)
    expect(parsePromocionBody(bodyOk({ activa: undefined }))?.activa).toBe(true)
  })
})

describe('parseUsoBody', () => {
  it('deriva mes/anio de la fecha como string', () => {
    expect(parseUsoBody({ fecha: '2026-10-31', monto_gasto: 5000 })).toEqual({
      fecha: '2026-10-31', mes: 10, anio: 2026, montoGasto: 5000, notas: null,
    })
  })

  it('rechaza fecha inválida o monto no positivo', () => {
    expect(parseUsoBody({ fecha: 'hoy', monto_gasto: 5 })).toBeNull()
    expect(parseUsoBody({ fecha: '2026-10-01', monto_gasto: 0 })).toBeNull()
    expect(parseUsoBody({ fecha: '2026-10-01', monto_gasto: -3 })).toBeNull()
  })
})

describe('toPromocionResponse', () => {
  it('mapea a snake_case con tarjetas y concepto', () => {
    const r = toPromocionResponse({
      id: 1, lugar: 'Coto', conceptoId: 3, concepto: { nombre: 'Coto' }, porcentaje: 15, topeMensual: 8000,
      dias: [4, 1], efectivo: true, activa: true, notas: null,
      tarjetas: [{ id: 9, nombre: 'Visa', banco: 'Galicia', marca: 'visa', bancoLogo: 'galicia', bancoIcono: null }],
    })
    expect(r).toMatchObject({
      concepto_id: 3, concepto_nombre: 'Coto', tope_mensual: 8000, dias: [1, 4], tarjeta_ids: [9], efectivo: true,
    })
    expect(r.tarjetas[0]).toEqual({ id: 9, nombre: 'Visa', banco: 'Galicia', marca: 'visa', banco_logo: 'galicia', banco_icono: null })
  })
})

describe('consumoAutomatico', () => {
  const g = (over: Record<string, any> = {}) => ({ promocionId: 1, totalMoneda: 1000, tipoCambio: 1, ...over })

  it('suma sólo los gastos asociados a ESA promo (no los del mismo concepto sin asociar)', () => {
    const gastos = [g(), g({ totalMoneda: 500 }), g({ promocionId: 2 }), g({ promocionId: null })]
    expect(consumoAutomatico(1, gastos)).toBe(1500)
  })

  it('convierte a ARS con el tipo de cambio y las devoluciones restan', () => {
    expect(consumoAutomatico(1, [g({ totalMoneda: 10, tipoCambio: 1000 }), g({ totalMoneda: -2000 })])).toBe(8000)
  })

  it('sin gastos asociados es 0', () => {
    expect(consumoAutomatico(1, [g({ promocionId: null })])).toBe(0)
    expect(consumoAutomatico(1, [])).toBe(0)
  })
})

describe('medioCoincide', () => {
  const promo = { tarjetaIds: [10], efectivo: false }

  it('una tarjeta de la promo coincide; otra no', () => {
    expect(medioCoincide(promo, { tipoPago: 'C', tarjetaId: 10 })).toBe(true)
    expect(medioCoincide(promo, { tipoPago: 'C', tarjetaId: 11 })).toBe(false)
  })

  it('efectivo = débito sin tarjeta, y sólo si la promo lo admite', () => {
    const efectivo = { tipoPago: 'D', tarjetaId: null }
    expect(medioCoincide(promo, efectivo)).toBe(false)
    expect(medioCoincide({ ...promo, efectivo: true }, efectivo)).toBe(true)
    // débito con una tarjeta que no es de la promo no es efectivo
    expect(medioCoincide({ ...promo, efectivo: true }, { tipoPago: 'D', tarjetaId: 11 })).toBe(false)
  })
})

describe('vigenteEnMes', () => {
  it('sin vigencia vale siempre', () => {
    expect(vigenteEnMes({}, 10, 2026)).toBe(true)
    expect(vigenteEnMes({ vigenteDesde: null, vigenteHasta: null }, 1, 2030)).toBe(true)
  })

  it('una promo que arranca a mitad de mes ya vale en ese mes, no en los anteriores', () => {
    const p = { vigenteDesde: '2026-10-15' }
    expect(vigenteEnMes(p, 9, 2026)).toBe(false)
    expect(vigenteEnMes(p, 10, 2026)).toBe(true)
    expect(vigenteEnMes(p, 11, 2026)).toBe(true)
  })

  it('vence a mitad de mes: sigue vigente ese mes, no los siguientes', () => {
    const p = { vigenteHasta: '2026-10-10' }
    expect(vigenteEnMes(p, 10, 2026)).toBe(true)
    expect(vigenteEnMes(p, 11, 2026)).toBe(false)
  })

  it('cruza el año', () => {
    expect(vigenteEnMes({ vigenteDesde: '2026-12-20' }, 12, 2026)).toBe(true)
    expect(vigenteEnMes({ vigenteHasta: '2026-12-20' }, 1, 2027)).toBe(false)
  })
})

describe('progresoPromocion', () => {
  // 20% hasta $10.000 → hay que gastar $50.000 para agotar el tope.
  const promo = { porcentaje: 20, topeMensual: 10000 }

  it('gasto mínimo = tope ÷ porcentaje', () => {
    expect(progresoPromocion(promo, 0, 0).gasto_minimo).toBe(50000)
    expect(progresoPromocion({ porcentaje: 10, topeMensual: 3000 }, 0, 0).gasto_minimo).toBe(30000)
  })

  it('sin consumo: todo el tope disponible', () => {
    expect(progresoPromocion(promo, 0, 0)).toMatchObject({
      estado: 'sin_uso', reintegrado: 0, disponible: 10000, gasto_restante: 50000, pct_tope: 0,
    })
  })

  it('en curso: reintegro parcial y lo que falta gastar', () => {
    expect(progresoPromocion(promo, 20000, 0)).toMatchObject({
      estado: 'en_curso', consumo: 20000, reintegrado: 4000, disponible: 6000, gasto_restante: 30000, pct_tope: 40,
    })
  })

  it('suma el consumo automático y el manual', () => {
    const p = progresoPromocion(promo, 20000, 5000)
    expect(p).toMatchObject({ consumo_auto: 20000, consumo_manual: 5000, consumo: 25000, reintegrado: 5000 })
  })

  it('tope alcanzado: el reintegro se topea y no queda nada por gastar', () => {
    expect(progresoPromocion(promo, 50000, 0)).toMatchObject({
      estado: 'tope_alcanzado', reintegrado: 10000, disponible: 0, gasto_restante: 0, pct_tope: 100,
    })
    // gastar de más no devuelve más
    expect(progresoPromocion(promo, 80000, 0)).toMatchObject({ reintegrado: 10000, disponible: 0, gasto_restante: 0 })
  })

  it('un consumo negativo no da reintegro negativo', () => {
    expect(progresoPromocion(promo, -3000, 0)).toMatchObject({ estado: 'sin_uso', reintegrado: 0, disponible: 10000 })
  })
})

describe('totalesPromociones', () => {
  const item = (activa: boolean, tope: number, consumo: number) => ({
    activa,
    tope_mensual: tope,
    progreso: progresoPromocion({ porcentaje: 10, topeMensual: tope }, consumo, 0),
  })

  it('suma sólo las activas y cuenta las completas', () => {
    const t = totalesPromociones([item(true, 1000, 10000), item(true, 2000, 5000), item(false, 9999, 0)])
    expect(t).toEqual({ tope_total: 3000, reintegrado: 1500, disponible: 1500, completas: 1 })
  })

  it('no cuenta las promos fuera de vigencia en el período', () => {
    const fuera = { ...item(true, 5000, 0), vigente: false }
    expect(totalesPromociones([item(true, 1000, 0), fuera]).tope_total).toBe(1000)
  })
})

describe('semana', () => {
  const promos = [
    { id: 1, activa: true, dias: [0, 4] },
    { id: 2, activa: true, dias: [4] },
    { id: 3, activa: false, dias: [4] },
  ]

  it('promosDelDia ignora las que están fuera de vigencia en el período', () => {
    const conVigencia = [{ id: 1, activa: true, vigente: false, dias: [4] }, { id: 2, activa: true, vigente: true, dias: [4] }]
    expect(promosDelDia(conVigencia, 4).map(p => p.id)).toEqual([2])
  })

  it('promosDelDia ignora las inactivas', () => {
    expect(promosDelDia(promos, 4).map(p => p.id)).toEqual([1, 2])
    expect(promosDelDia(promos, 1)).toEqual([])
  })

  it('semanaPromos devuelve siempre 7 días, lunes a domingo', () => {
    const s = semanaPromos(promos)
    expect(s).toHaveLength(7)
    expect(s.map(d => d.dia)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(s[0].promos.map(p => p.id)).toEqual([1])
  })

  it('ordenarPorDisponible pone al final las que ya agotaron el tope', () => {
    const mk = (id: number, consumo: number, tope: number) => ({
      id, progreso: progresoPromocion({ porcentaje: 10, topeMensual: tope }, consumo, 0),
    })
    const orden = ordenarPorDisponible([mk(1, 99999, 1000), mk(2, 0, 500), mk(3, 0, 2000)])
    expect(orden.map(p => p.id)).toEqual([3, 2, 1])
  })
})
