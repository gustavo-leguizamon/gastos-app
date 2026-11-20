import { describe, it, expect } from 'vitest'
import {
  diaSemanaDeFecha,
  diaCoincide,
  reglaDeRespuesta,
  reintegroDeCompra,
  textoFaltaTope,
  textoReintegro,
  fechaEnVigencia,
  coincideModalidad,
  parsePromocionBody,
  parseUsoBody,
  toPromocionResponse,
  consumoAutomatico,
  medioCoincide,
  vigenteEnCiclo,
  rangoCiclo,
  ultimoDiaDelMes,
  cicloDeFecha,
  cicloDeGasto,
  promocionFechaDeBody,
  consumoEnCiclo,
  lotesPromocion,
  saldoPromocion,
  parseSaldoUsoBody,
  ordenarPorVencimiento,
  progresoPromocion,
  totalesPromociones,
  promosDelDia,
  semanaPromos,
  ordenarPorDisponible,
  parseReintegroBody,
  toReintegroResponse,
  diasHasta,
  estadoVencimiento,
  criteriosDe,
  tieneCriterios,
  criterioCoincide,
  whereGastoCriterios,
  avisoPromociones,
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

describe('coincideModalidad', () => {
  it('todas no filtra; presencial/virtual incluyen las ambas', () => {
    const ps = [{ modalidad: 'presencial' }, { modalidad: 'virtual' }, { modalidad: 'ambas' }, {}]
    expect(ps.filter(x => coincideModalidad(x, 'todas'))).toHaveLength(4)
    expect(ps.filter(x => coincideModalidad(x, 'presencial')).map(x => x.modalidad)).toEqual(['presencial', 'ambas'])
    expect(ps.filter(x => coincideModalidad(x, 'virtual')).map(x => x.modalidad)).toEqual(['virtual', 'ambas', undefined])
  })
})

describe('parsePromocionBody', () => {
  it('normaliza lugar, ordena y deduplica días y tarjetas', () => {
    expect(parsePromocionBody(bodyOk({ tarjeta_ids: [2, 1, 2] }))).toEqual({
      lugar: 'Carrefour',
      conceptoIds: [],
      categoriaIds: [],
      etiquetaIds: [],
      tipo: 'porcentaje',
      porcentaje: 20,
      topeMensual: 10000,
      montoReintegro: null,
      compraMinima: null,
      dias: [2, 4],
      tarjetaIds: [2, 1],
      efectivo: false,
      modalidad: 'virtual',
      activa: true,
      notas: null,
      vigenteDesde: null,
      vigenteHasta: null,
      diaReinicio: 1,
    })
  })

  it('día de reinicio: 1–31, sin valor = 1, fuera de rango o no entero es inválido', () => {
    expect(parsePromocionBody(bodyOk({ dia_reinicio: 5 }))).toMatchObject({ diaReinicio: 5 })
    expect(parsePromocionBody(bodyOk({ dia_reinicio: '31' }))).toMatchObject({ diaReinicio: 31 })
    expect(parsePromocionBody(bodyOk({ dia_reinicio: '' }))).toMatchObject({ diaReinicio: 1 })
    expect(parsePromocionBody(bodyOk({ dia_reinicio: 0 }))).toBeNull()
    expect(parsePromocionBody(bodyOk({ dia_reinicio: 32 }))).toBeNull()
    expect(parsePromocionBody(bodyOk({ dia_reinicio: 2.5 }))).toBeNull()
  })

  it('toPromocionResponse expone dia_reinicio (1 si la fila no lo tiene)', () => {
    expect(toPromocionResponse({ id: 1, lugar: 'x', diaReinicio: 5 }).dia_reinicio).toBe(5)
    expect(toPromocionResponse({ id: 1, lugar: 'x' }).dia_reinicio).toBe(1)
  })

  it('modalidad: presencial / virtual / ambas; sin valor = virtual; desconocida es inválida', () => {
    expect(parsePromocionBody(bodyOk({ modalidad: 'presencial' }))).toMatchObject({ modalidad: 'presencial' })
    expect(parsePromocionBody(bodyOk({ modalidad: 'virtual' }))).toMatchObject({ modalidad: 'virtual' })
    expect(parsePromocionBody(bodyOk({ modalidad: '' }))).toMatchObject({ modalidad: 'virtual' })
    expect(parsePromocionBody(bodyOk({ modalidad: 'telefonica' }))).toBeNull()
  })

  it('la respuesta expone la modalidad (y cae en virtual si la fila no la trae)', () => {
    expect(toPromocionResponse({ id: 1, lugar: 'X', modalidad: 'virtual' }).modalidad).toBe('virtual')
    expect(toPromocionResponse({ id: 1, lugar: 'X' }).modalidad).toBe('virtual')
  })

  it('acepta sólo efectivo (sin tarjetas) y varios conceptos vinculados (sin repetir)', () => {
    const r = parsePromocionBody(bodyOk({ tarjeta_ids: [], efectivo: true, concepto_ids: [7, 3, 7] }))
    expect(r).toMatchObject({ tarjetaIds: [], efectivo: true, conceptoIds: [7, 3] })
  })

  it('acepta categorías y etiquetas vinculadas (sin repetir, ids numéricos)', () => {
    const r = parsePromocionBody(bodyOk({ categoria_ids: [4, '4', 2], etiqueta_ids: [9, 9] }))
    expect(r).toMatchObject({ categoriaIds: [4, 2], etiquetaIds: [9] })
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
    ['concepto inválido', { concepto_ids: [5, -1] }],
    ['categoría inválida', { categoria_ids: [0] }],
    ['etiqueta inválida', { etiqueta_ids: ['x'] }],
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
  it('mapea a snake_case con tarjetas y conceptos', () => {
    const r = toPromocionResponse({
      id: 1, lugar: 'Coto', conceptos: [{ id: 3, nombre: 'Coto' }, { id: 4, nombre: 'Coto Digital' }], porcentaje: 15, topeMensual: 8000,
      dias: [4, 1], efectivo: true, activa: true, notas: null,
      tarjetas: [{ id: 9, nombre: 'Visa', banco: 'Galicia', marca: 'visa', bancoLogo: 'galicia', bancoIcono: null }],
    })
    expect(r).toMatchObject({
      concepto_ids: [3, 4], concepto_nombres: ['Coto', 'Coto Digital'], tope_mensual: 8000, dias: [1, 4], tarjeta_ids: [9], efectivo: true,
    })
    expect(r.tarjetas[0]).toEqual({ id: 9, nombre: 'Visa', banco: 'Galicia', marca: 'visa', banco_logo: 'galicia', banco_icono: null })
  })

  it('mapea categorías y etiquetas vinculadas; sin incluirlas quedan vacías', () => {
    const base = { id: 1, lugar: 'X', porcentaje: 10, topeMensual: 1, dias: [0], efectivo: true }
    expect(toPromocionResponse({
      ...base, categorias: [{ id: 2, nombre: 'Comida' }], etiquetas: [{ id: 7, nombre: 'Delivery' }],
    })).toMatchObject({ categoria_ids: [2], categoria_nombres: ['Comida'], etiqueta_ids: [7], etiqueta_nombres: ['Delivery'] })
    expect(toPromocionResponse(base)).toMatchObject({ categoria_ids: [], etiqueta_ids: [] })
  })
})

describe('criterios vinculados', () => {
  const promo = { conceptoIds: [5], categoriaIds: [2], etiquetaIds: [7, 8] }
  const gasto = (over: Record<string, any> = {}) => ({ conceptoId: 99, categoriaId: null, etiquetaIds: [] as number[], ...over })

  it('criteriosDe saca los ids de la fila de Prisma', () => {
    expect(criteriosDe({ conceptos: [{ id: 5 }], categorias: [{ id: 2 }] })).toEqual({
      conceptoIds: [5], categoriaIds: [2], etiquetaIds: [],
    })
  })

  it('tieneCriterios con cualquiera de los tres ejes', () => {
    const vacio = { conceptoIds: [], categoriaIds: [], etiquetaIds: [] }
    expect(tieneCriterios(vacio)).toBe(false)
    expect(tieneCriterios({ ...vacio, categoriaIds: [1] })).toBe(true)
    expect(tieneCriterios({ ...vacio, etiquetaIds: [1] })).toBe(true)
  })

  it('coincide por concepto, por categoría o por alguna etiqueta (OR entre ejes)', () => {
    expect(criterioCoincide(promo, gasto({ conceptoId: 5 }))).toBe(true)
    expect(criterioCoincide(promo, gasto({ categoriaId: 2 }))).toBe(true)
    expect(criterioCoincide(promo, gasto({ etiquetaIds: [3, 8] }))).toBe(true)
    expect(criterioCoincide(promo, gasto({ categoriaId: 3, etiquetaIds: [3] }))).toBe(false)
  })

  it('una promo sin criterios no coincide con nada', () => {
    const vacio = { conceptoIds: [], categoriaIds: [], etiquetaIds: [] }
    expect(criterioCoincide(vacio, gasto({ conceptoId: 5, categoriaId: 2, etiquetaIds: [7] }))).toBe(false)
  })

  it('whereGastoCriterios arma sólo las condiciones de los ejes vinculados', () => {
    expect(whereGastoCriterios(promo)).toEqual([
      { conceptoId: { in: [5] } },
      { categoriaId: { in: [2] } },
      { etiquetas: { some: { id: { in: [7, 8] } } } },
    ])
    expect(whereGastoCriterios({ conceptoIds: [], categoriaIds: [4], etiquetaIds: [] })).toEqual([{ categoriaId: { in: [4] } }])
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

describe('vigenteEnCiclo', () => {
  it('sin vigencia vale siempre', () => {
    expect(vigenteEnCiclo({}, 10, 2026)).toBe(true)
    expect(vigenteEnCiclo({ vigenteDesde: null, vigenteHasta: null }, 1, 2030)).toBe(true)
  })

  it('una promo que arranca a mitad de mes ya vale en ese mes, no en los anteriores', () => {
    const p = { vigenteDesde: '2026-10-15' }
    expect(vigenteEnCiclo(p, 9, 2026)).toBe(false)
    expect(vigenteEnCiclo(p, 10, 2026)).toBe(true)
    expect(vigenteEnCiclo(p, 11, 2026)).toBe(true)
  })

  it('vence a mitad de mes: sigue vigente ese mes, no los siguientes', () => {
    const p = { vigenteHasta: '2026-10-10' }
    expect(vigenteEnCiclo(p, 10, 2026)).toBe(true)
    expect(vigenteEnCiclo(p, 11, 2026)).toBe(false)
  })

  it('cruza el año', () => {
    expect(vigenteEnCiclo({ vigenteDesde: '2026-12-20' }, 12, 2026)).toBe(true)
    expect(vigenteEnCiclo({ vigenteHasta: '2026-12-20' }, 1, 2027)).toBe(false)
  })

  it('con reinicio el 5 mira el ciclo 05 → 04, no el mes calendario', () => {
    // Termina el 03/12: el ciclo de noviembre (05/11 → 04/12) la incluye, el de diciembre no.
    const p = { vigenteHasta: '2026-12-03', diaReinicio: 5 }
    expect(vigenteEnCiclo(p, 11, 2026)).toBe(true)
    expect(vigenteEnCiclo(p, 12, 2026)).toBe(false)
    // Arranca el 02/11: cae en el ciclo de octubre (05/10 → 04/11).
    expect(vigenteEnCiclo({ vigenteDesde: '2026-11-02', diaReinicio: 5 }, 10, 2026)).toBe(true)
  })
})

describe('ciclo del tope', () => {
  it('con reinicio el 1 el ciclo es el mes calendario', () => {
    expect(rangoCiclo(11, 2026, 1)).toEqual({ desde: '2026-11-01', hasta: '2026-11-30' })
    expect(rangoCiclo(2, 2028, 1)).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' })
  })

  it('con reinicio el 5 va del 5 al 4 del mes siguiente, cruzando el año', () => {
    expect(rangoCiclo(11, 2026, 5)).toEqual({ desde: '2026-11-05', hasta: '2026-12-04' })
    expect(rangoCiclo(12, 2026, 5)).toEqual({ desde: '2026-12-05', hasta: '2027-01-04' })
  })

  it('un reinicio que no existe en el mes se recorta al último día', () => {
    expect(rangoCiclo(1, 2027, 31)).toEqual({ desde: '2027-01-31', hasta: '2027-02-27' })
    expect(rangoCiclo(2, 2027, 31)).toEqual({ desde: '2027-02-28', hasta: '2027-03-30' })
    expect(ultimoDiaDelMes(2, 2027)).toBe(28)
  })

  it('cicloDeFecha: antes del reinicio es el ciclo del mes anterior', () => {
    expect(cicloDeFecha('2026-12-03', 5)).toEqual({ mes: 11, anio: 2026 })
    expect(cicloDeFecha('2026-12-05', 5)).toEqual({ mes: 12, anio: 2026 })
    expect(cicloDeFecha('2027-01-04', 5)).toEqual({ mes: 12, anio: 2026 })
    expect(cicloDeFecha('2026-12-03', 1)).toEqual({ mes: 12, anio: 2026 })
    expect(cicloDeFecha('2027-02-28', 31)).toEqual({ mes: 2, anio: 2027 })
    expect(cicloDeFecha('x', 5)).toBeNull()
  })

  it('cicloDeGasto: la fecha de compra manda; sin ella, el mes del gasto', () => {
    expect(cicloDeGasto({ mes: 12, anio: 2026, promocionFecha: '2026-12-03' }, 5)).toEqual({ mes: 11, anio: 2026 })
    expect(cicloDeGasto({ mes: 12, anio: 2026, promocionFecha: null }, 5)).toEqual({ mes: 12, anio: 2026 })
    expect(cicloDeGasto({ mes: 12, anio: 2026 }, 5)).toEqual({ mes: 12, anio: 2026 })
  })
})

describe('promocionFechaDeBody', () => {
  it('alta: la fecha sólo se guarda con promo y válida', () => {
    expect(promocionFechaDeBody({ promocion_id: 3, promocion_fecha: '2026-11-19' }, false)).toBe('2026-11-19')
    expect(promocionFechaDeBody({ promocion_id: 3, promocion_fecha: '' }, false)).toBeNull()
    expect(promocionFechaDeBody({ promocion_id: 3 }, false)).toBeNull()
    expect(promocionFechaDeBody({ promocion_id: null, promocion_fecha: '2026-11-19' }, false)).toBeNull()
    expect(promocionFechaDeBody({ promocion_fecha: '2026-11-19' }, false)).toBeNull()
  })

  it('PUT parcial: sin las claves no toca nada; sacar la promo borra la fecha', () => {
    expect(promocionFechaDeBody({ total_moneda: 5 }, true)).toBeUndefined()
    expect(promocionFechaDeBody({ promocion_id: 3 }, true)).toBeUndefined()
    expect(promocionFechaDeBody({ promocion_id: 3, promocion_fecha: '2026-11-19' }, true)).toBe('2026-11-19')
    expect(promocionFechaDeBody({ promocion_id: 3, promocion_fecha: null }, true)).toBeNull()
    expect(promocionFechaDeBody({ promocion_id: null }, true)).toBeNull()
    expect(promocionFechaDeBody({ promocion_fecha: '2026-11-20' }, true)).toBe('2026-11-20')
  })
})

describe('consumoEnCiclo', () => {
  const promo = { id: 1, diaReinicio: 5 }
  const g = (mes: number, total: number, promocionFecha: string | null = null, promocionId = 1) =>
    ({ promocionId, mes, anio: 2026, promocionFecha, totalMoneda: total, tipoCambio: 1 })

  it('cuenta cada gasto en el ciclo de su fecha de compra, o de su mes si no tiene', () => {
    const gastos = [
      g(12, 1000, '2026-12-03'), // ciclo nov
      g(12, 2000, '2026-12-06'), // ciclo dic
      g(11, 4000), // sin fecha → ciclo nov
      g(11, 8000, null, 2), // otra promo
    ]
    expect(consumoEnCiclo(promo, { mes: 11, anio: 2026 }, gastos, []).auto).toBe(5000)
    expect(consumoEnCiclo(promo, { mes: 12, anio: 2026 }, gastos, []).auto).toBe(2000)
  })

  it('los usos manuales van por su fecha', () => {
    const usos = [{ fecha: '2026-12-04', montoGasto: 300 }, { fecha: '2026-12-05', montoGasto: 700 }]
    expect(consumoEnCiclo(promo, { mes: 11, anio: 2026 }, [], usos).manual).toBe(300)
    expect(consumoEnCiclo(promo, { mes: 12, anio: 2026 }, [], usos).manual).toBe(700)
  })
})

describe('lotesPromocion', () => {
  // 50% hasta $10.000 por ciclo.
  const promo = { id: 1, porcentaje: 50, topeMensual: 10000, diaReinicio: 1 }
  const g = (mes: number, total: number) => ({ promocionId: 1, mes, anio: 2026, promocionFecha: null, totalMoneda: total, tipoCambio: 1 })

  it('un lote por ciclo con reintegro, topeado, con su vencimiento cargado', () => {
    const lotes = lotesPromocion(
      promo,
      [g(11, 10000), g(10, 40000), g(9, -500)],
      [],
      [{ mes: 11, anio: 2026, venceEl: '2026-12-31', utilizado: false }],
    )
    expect(lotes).toEqual([
      { mes: 10, anio: 2026, desde: '2026-10-01', monto: 10000, vence_el: null, utilizado: false },
      { mes: 11, anio: 2026, desde: '2026-11-01', monto: 5000, vence_el: '2026-12-31', utilizado: false },
    ])
  })
})

describe('saldoPromocion', () => {
  const lote = (mes: number, monto: number, vence_el: string | null = null, utilizado = false) =>
    ({ mes, anio: 2026, desde: `2026-${String(mes).padStart(2, '0')}-01`, monto, vence_el, utilizado })

  it('recupero 5000 y uso 2000: quedan 3000; lo próximo que recupere se suma', () => {
    const s = saldoPromocion([lote(10, 5000)], [{ fecha: '2026-10-20', monto: 2000 }], '2026-10-25')
    expect(s).toMatchObject({ disponible: 3000, reintegrado: 5000, usado: 2000, vencido: 0, sin_respaldo: 0 })

    const s2 = saldoPromocion([lote(10, 5000), lote(11, 4000)], [{ fecha: '2026-10-20', monto: 2000 }], '2026-11-10')
    expect(s2.disponible).toBe(7000)
  })

  it('un uso descuenta primero de lo que vence antes', () => {
    const s = saldoPromocion(
      [lote(10, 5000, '2026-12-31'), lote(11, 4000, '2026-11-30')],
      [{ fecha: '2026-11-15', monto: 6000 }],
      '2026-11-16',
    )
    expect(s.lotes.map(l => [l.mes, l.usado, l.restante])).toEqual([[10, 2000, 3000], [11, 4000, 0]])
    expect(s.disponible).toBe(3000)
    expect(s.proximo_vencimiento).toEqual({ vence_el: '2026-12-31', monto: 3000 })
  })

  it('lo que no se usó antes de vencer se pierde y no suma al saldo', () => {
    const s = saldoPromocion([lote(10, 5000, '2026-11-10'), lote(11, 4000)], [{ fecha: '2026-11-05', monto: 1000 }], '2026-11-11')
    expect(s).toMatchObject({ disponible: 4000, vencido: 4000, usado: 1000 })
    expect(s.lotes[0].estado).toBe('vencido')
    // El día del vencimiento todavía se puede usar.
    expect(saldoPromocion([lote(10, 5000, '2026-11-10')], [], '2026-11-10').disponible).toBe(5000)
  })

  it('un uso no consume un lote que ya había vencido ni uno de un ciclo posterior', () => {
    const s = saldoPromocion(
      [lote(10, 5000, '2026-10-31'), lote(12, 4000)],
      [{ fecha: '2026-11-15', monto: 1000 }],
      '2026-12-10',
    )
    expect(s.sin_respaldo).toBe(1000)
    expect(s.disponible).toBe(4000)
    expect(s.vencido).toBe(5000)
  })

  it('"ya lo usé" consume el lote entero', () => {
    const s = saldoPromocion([lote(10, 5000, null, true), lote(11, 1000)], [], '2026-11-10')
    expect(s).toMatchObject({ disponible: 1000, usado: 5000 })
    expect(s.lotes[0].estado).toBe('usado')
  })

  it('sin lotes: saldo 0 y sin vencimiento', () => {
    expect(saldoPromocion([], [], '2026-11-10')).toMatchObject({ disponible: 0, reintegrado: 0, proximo_vencimiento: null })
  })
})

describe('parseSaldoUsoBody', () => {
  it('fecha válida y monto > 0', () => {
    expect(parseSaldoUsoBody({ fecha: '2026-11-10', monto: '2000.456', notas: ' x ' })).toEqual({ fecha: '2026-11-10', monto: 2000.46, notas: 'x' })
    expect(parseSaldoUsoBody({ fecha: '2026-11-10', monto: 0 })).toBeNull()
    expect(parseSaldoUsoBody({ fecha: 'x', monto: 5 })).toBeNull()
    expect(parseSaldoUsoBody(null)).toBeNull()
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
    expect(t).toEqual({ tope_total: 3000, reintegrado: 1500, disponible: 1500, completas: 1, saldo: 0 })
  })

  it('el saldo suma todas las promos, también las inactivas o fuera de vigencia', () => {
    const t = totalesPromociones([
      { ...item(true, 1000, 0), saldo: { disponible: 300 } },
      { ...item(false, 1000, 0), saldo: { disponible: 200 } },
      { ...item(true, 1000, 0), vigente: false, saldo: { disponible: 100 } },
    ])
    expect(t.saldo).toBe(600)
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

describe('parseReintegroBody', () => {
  it('toma mes, año, fecha y la marca de utilizado', () => {
    expect(parseReintegroBody({ mes: 10, anio: 2026, vence_el: '2026-12-15', utilizado: true })).toEqual({
      mes: 10, anio: 2026, venceEl: '2026-12-15', utilizado: true,
    })
  })

  it('fecha vacía = sin vencimiento; utilizado por defecto es false', () => {
    expect(parseReintegroBody({ mes: 10, anio: 2026, vence_el: '' })).toEqual({
      mes: 10, anio: 2026, venceEl: null, utilizado: false,
    })
    expect(parseReintegroBody({ mes: 10, anio: 2026 })?.venceEl).toBeNull()
  })

  it.each([
    ['sin body', null],
    ['mes 13', { mes: 13, anio: 2026 }],
    ['mes 0', { mes: 0, anio: 2026 }],
    ['sin año', { mes: 10 }],
    ['fecha inválida', { mes: 10, anio: 2026, vence_el: '15/12/2026' }],
  ])('rechaza %s', (_n, body) => {
    expect(parseReintegroBody(body)).toBeNull()
  })
})

describe('toReintegroResponse', () => {
  it('mapea a snake_case y devuelve null si no hay fila', () => {
    expect(toReintegroResponse({ venceEl: '2026-12-15', utilizado: false })).toEqual({ vence_el: '2026-12-15', utilizado: false })
    expect(toReintegroResponse({ venceEl: null, utilizado: true })).toEqual({ vence_el: null, utilizado: true })
    expect(toReintegroResponse(undefined)).toBeNull()
  })
})

describe('diasHasta', () => {
  it('0 = hoy, positivo = faltan, negativo = ya venció', () => {
    expect(diasHasta('2026-10-30', '2026-10-30')).toBe(0)
    expect(diasHasta('2026-10-30', '2026-11-04')).toBe(5)
    expect(diasHasta('2026-10-30', '2026-10-28')).toBe(-2)
  })

  it('cruza fin de mes y de año sin correr un día', () => {
    expect(diasHasta('2026-12-30', '2027-01-02')).toBe(3)
    expect(diasHasta('2026-02-27', '2026-03-01')).toBe(2)
  })

  it('null con fechas inválidas', () => {
    expect(diasHasta('hoy', '2026-10-30')).toBeNull()
    expect(diasHasta('2026-10-30', 'mañana')).toBeNull()
  })
})

describe('estadoVencimiento', () => {
  const hoy = '2026-10-30'

  it.each([
    ['2026-10-29', 'vencido', -1],
    ['2026-10-30', 'urgente', 0], // vence hoy: todavía se puede usar, pero es lo más urgente
    ['2026-11-06', 'urgente', 7],
    ['2026-11-07', 'proximo', 8],
    ['2026-11-14', 'proximo', 15],
    ['2026-11-15', 'ok', 16],
  ])('%s → %s', (fecha, nivel, dias) => {
    expect(estadoVencimiento(fecha, hoy)).toEqual({ dias, nivel })
  })

  it('null sin fecha o con fecha inválida', () => {
    expect(estadoVencimiento(null, hoy)).toBeNull()
    expect(estadoVencimiento('', hoy)).toBeNull()
    expect(estadoVencimiento('x', hoy)).toBeNull()
  })
})

describe('ordenarPorVencimiento', () => {
  const p = (id: number, vence_el: string | null) =>
    ({ id, saldo: { proximo_vencimiento: vence_el ? { vence_el, monto: 1 } : null } })

  it('el vencimiento más cercano primero, sin vencimiento al final, sin mutar', () => {
    const lista = [p(1, null), p(2, '2026-12-01'), p(3, '2026-11-20')]
    expect(ordenarPorVencimiento(lista).map(x => x.id)).toEqual([3, 2, 1])
    expect(lista.map(x => x.id)).toEqual([1, 2, 3])
  })
})

describe('diaCoincide', () => {
  it('vale sólo los días de la promo', () => {
    expect(diaCoincide({ dias: [1] }, '2026-10-27')).toBe(true) // martes
    expect(diaCoincide({ dias: [1] }, '2026-10-31')).toBe(false) // sábado
  })

  it('sin fecha válida no descarta', () => {
    expect(diaCoincide({ dias: [1] }, null)).toBe(true)
    expect(diaCoincide({ dias: [1] }, 'basura')).toBe(true)
  })
})

describe('avisoPromociones', () => {
  // 2026-11-06 es viernes (4).
  const HOY = '2026-11-06'
  const promo = (id: number, over: Record<string, any> = {}) => ({
    id,
    activa: true,
    vigente: true,
    dias: [4],
    progreso: progresoPromocion({ porcentaje: 20, topeMensual: 10000 }, 0, 0),
    ...over,
  })
  const conSaldo = (id: number, disponible: number, vence_el: string | null = '2026-11-20') =>
    promo(id, {
      dias: [0], // no vale hoy: sólo aparece por el saldo
      saldo: { disponible, proximo_vencimiento: vence_el ? { vence_el, monto: disponible } : null },
    })

  it('lista las promos de hoy con tope por aprovechar, más disponible primero', () => {
    const a = promo(1, { progreso: progresoPromocion({ porcentaje: 20, topeMensual: 10000 }, 30000, 0) }) // disponible 4000
    const b = promo(2) // disponible 10000
    const r = avisoPromociones([a, b], HOY)
    expect(r.deHoy.map(p => p.id)).toEqual([2, 1])
    expect(r.mostrar).toBe(true)
  })

  it('omite las de otro día, inactivas, fuera de vigencia y con el tope agotado', () => {
    const otroDia = promo(1, { dias: [0] })
    const inactiva = promo(2, { activa: false })
    const fuera = promo(3, { vigente: false })
    const agotada = promo(4, { progreso: progresoPromocion({ porcentaje: 20, topeMensual: 10000 }, 60000, 0) })
    const r = avisoPromociones([otroDia, inactiva, fuera, agotada], HOY)
    expect(r.deHoy).toEqual([])
    expect(r.mostrar).toBe(false)
  })

  it('lista las promos con saldo a favor (también sin vencimiento), la que vence antes primero', () => {
    const r = avisoPromociones([conSaldo(1, 1500.5), conSaldo(2, 2000, '2026-11-08'), conSaldo(3, 900, null), conSaldo(4, 0)], HOY)
    expect(r.saldos.map(p => p.id)).toEqual([2, 1, 3])
    expect(r.saldoTotal).toBe(4400.5)
    expect(r.mostrar).toBe(true)
  })

  it('con una fecha inválida no lista promos del día pero sí los saldos', () => {
    const r = avisoPromociones([promo(1), conSaldo(2, 100)], 'basura')
    expect(r.deHoy).toEqual([])
    expect(r.saldos).toHaveLength(1)
  })
})

describe('fechaEnVigencia', () => {
  it('sin vigencia o sin fecha válida no descarta nada', () => {
    expect(fechaEnVigencia({}, '2026-11-03')).toBe(true)
    expect(fechaEnVigencia({ vigenteDesde: '2026-11-18', vigenteHasta: '2026-11-18' }, null)).toBe(true)
    expect(fechaEnVigencia({ vigenteDesde: '2026-11-18', vigenteHasta: '2026-11-18' }, 'basura')).toBe(true)
  })

  it('una promo de un solo día sólo acepta ese día (extremos inclusive)', () => {
    const promo = { vigenteDesde: '2026-11-18', vigenteHasta: '2026-11-18' }
    expect(fechaEnVigencia(promo, '2026-11-18')).toBe(true)
    expect(fechaEnVigencia(promo, '2026-11-17')).toBe(false)
    expect(fechaEnVigencia(promo, '2026-11-19')).toBe(false)
  })

  it('un límite abierto de un lado no recorta ese lado', () => {
    expect(fechaEnVigencia({ vigenteDesde: '2026-11-10' }, '2027-05-01')).toBe(true)
    expect(fechaEnVigencia({ vigenteDesde: '2026-11-10' }, '2026-11-09')).toBe(false)
    expect(fechaEnVigencia({ vigenteHasta: '2026-11-10' }, '2020-01-01')).toBe(true)
    expect(fechaEnVigencia({ vigenteHasta: '2026-11-10' }, '2026-11-11')).toBe(false)
  })
})

describe('promos de monto fijo', () => {
  // $5.000 por compra desde $20.000, tope $15.000 (tres compras).
  const promo = { tipo: 'monto_fijo', porcentaje: 0, topeMensual: 15000, montoReintegro: 5000, compraMinima: 20000 }
  /** Intl.NumberFormat usa espacio duro entre el $ y el número. */
  const plano = (t: string) => t.replace(/\s/g, ' ')

  it('parsePromocionBody: monto > 0, mínima opcional (0 = cualquiera), tope opcional (= un reintegro)', () => {
    const fijo = (over: Record<string, any> = {}) =>
      bodyOk({ tipo: 'monto_fijo', porcentaje: undefined, monto_reintegro: 5000, compra_minima: 20000, tope_mensual: 15000, ...over })
    expect(parsePromocionBody(fijo())).toMatchObject({
      tipo: 'monto_fijo', porcentaje: 0, montoReintegro: 5000, compraMinima: 20000, topeMensual: 15000,
    })
    expect(parsePromocionBody(fijo({ tope_mensual: '' }))).toMatchObject({ topeMensual: 5000 })
    expect(parsePromocionBody(fijo({ tope_mensual: null }))).toMatchObject({ topeMensual: 5000 })
    expect(parsePromocionBody(fijo({ compra_minima: '' }))).toMatchObject({ compraMinima: null })
    expect(parsePromocionBody(fijo({ compra_minima: 0 }))).toMatchObject({ compraMinima: null })
    expect(parsePromocionBody(fijo({ monto_reintegro: 0 }))).toBeNull()
    expect(parsePromocionBody(fijo({ monto_reintegro: '' }))).toBeNull()
    expect(parsePromocionBody(fijo({ compra_minima: -1 }))).toBeNull()
    expect(parsePromocionBody(fijo({ tope_mensual: 0 }))).toBeNull()
    expect(parsePromocionBody(bodyOk({ tipo: 'otro' }))).toBeNull()
  })

  it('parsePromocionBody: sin tipo es porcentaje y descarta monto/mínima', () => {
    expect(parsePromocionBody(bodyOk({ monto_reintegro: 5000, compra_minima: 100 }))).toMatchObject({
      tipo: 'porcentaje', porcentaje: 20, montoReintegro: null, compraMinima: null,
    })
  })

  it('toPromocionResponse: tipo (porcentaje si la fila no lo tiene), monto y mínima', () => {
    expect(toPromocionResponse({ id: 1, lugar: 'x', porcentaje: 20 })).toMatchObject({
      tipo: 'porcentaje', monto_reintegro: null, compra_minima: null,
    })
    expect(toPromocionResponse({ id: 1, lugar: 'x', ...promo })).toMatchObject({
      tipo: 'monto_fijo', monto_reintegro: 5000, compra_minima: 20000,
    })
  })

  it('reintegroDeCompra: el monto fijo si llega a la mínima (inclusive), 0 si no', () => {
    expect(reintegroDeCompra(promo, 20000)).toBe(5000)
    expect(reintegroDeCompra(promo, 80000)).toBe(5000)
    expect(reintegroDeCompra(promo, 19999.99)).toBe(0)
    expect(reintegroDeCompra(promo, -30000)).toBe(0)
    expect(reintegroDeCompra({ ...promo, compraMinima: null }, 1)).toBe(5000)
    // En porcentaje es lineal.
    expect(reintegroDeCompra({ porcentaje: 20, topeMensual: 1000 }, 3000)).toBe(600)
  })

  it('progresoPromocion: cuenta compra por compra, no la suma', () => {
    // 15.000 + 15.000 suman 30.000 pero ninguna llega a la mínima.
    expect(progresoPromocion(promo, 30000, 0, [15000, 15000])).toMatchObject({
      estado: 'sin_uso', consumo: 30000, reintegrado: 0, disponible: 15000,
      compras_validas: 0, compras_restantes: 3, gasto_minimo: 60000, gasto_restante: 60000,
    })
    expect(progresoPromocion(promo, 45000, 0, [25000, 20000])).toMatchObject({
      estado: 'en_curso', reintegrado: 10000, disponible: 5000, pct_tope: 67,
      compras_validas: 2, compras_restantes: 1, gasto_restante: 20000,
    })
  })

  it('progresoPromocion: el tope topea, y un tope que no es múltiplo pide una compra más', () => {
    expect(progresoPromocion(promo, 0, 100000, [20000, 20000, 20000, 40000])).toMatchObject({
      estado: 'tope_alcanzado', reintegrado: 15000, disponible: 0, compras_restantes: 0, gasto_restante: 0, pct_tope: 100,
    })
    const p = progresoPromocion({ ...promo, topeMensual: 12000 }, 0, 0, [20000, 20000])
    expect(p).toMatchObject({ reintegrado: 10000, disponible: 2000, compras_restantes: 1, gasto_minimo: 60000 })
  })

  it('progresoPromocion en porcentaje no informa compras', () => {
    expect(progresoPromocion({ porcentaje: 20, topeMensual: 1000 }, 100, 0, [100])).toMatchObject({
      compras_validas: null, compras_restantes: null,
    })
  })

  it('consumoEnCiclo devuelve cada compra del ciclo (gastos en ARS + usos)', () => {
    const gastos = [
      { promocionId: 1, mes: 11, anio: 2026, promocionFecha: null, totalMoneda: 100, tipoCambio: 250 },
      { promocionId: 2, mes: 11, anio: 2026, promocionFecha: null, totalMoneda: 9999, tipoCambio: 1 },
      { promocionId: 1, mes: 12, anio: 2026, promocionFecha: null, totalMoneda: 7777, tipoCambio: 1 },
    ]
    const r = consumoEnCiclo({ id: 1 }, { mes: 11, anio: 2026 }, gastos, [{ fecha: '2026-11-10', montoGasto: 21000 }])
    expect(r).toEqual({ auto: 25000, manual: 21000, compras: [25000, 21000] })
  })

  it('lotesPromocion usa la regla de monto fijo', () => {
    const g = (total: number) => ({ promocionId: 1, mes: 11, anio: 2026, promocionFecha: null, totalMoneda: total, tipoCambio: 1 })
    const lotes = lotesPromocion({ id: 1, ...promo }, [g(25000), g(10000)], [], [])
    expect(lotes.map(l => l.monto)).toEqual([5000])
  })

  it('textos: reintegro y lo que falta para el tope', () => {
    const resp = { tipo: 'monto_fijo', porcentaje: 0, monto_reintegro: 5000, compra_minima: 20000 }
    expect(textoReintegro({ porcentaje: 20 })).toBe('20%')
    expect(plano(textoReintegro(resp))).toBe('$ 5.000 desde $ 20.000')
    expect(plano(textoReintegro({ ...resp, compra_minima: null }))).toBe('$ 5.000')
    expect(plano(textoFaltaTope({}, { gasto_restante: 30000 }))).toBe('gastando $ 30.000 más')
    expect(plano(textoFaltaTope(resp, { gasto_restante: 40000, compras_restantes: 2 }))).toBe('con 2 compras más de al menos $ 20.000')
    expect(textoFaltaTope({ tipo: 'monto_fijo' }, { gasto_restante: 0, compras_restantes: 1 })).toBe('con 1 compra más')
  })

  it('reglaDeRespuesta mapea la respuesta de la API a la regla', () => {
    expect(reglaDeRespuesta({ tipo: 'monto_fijo', porcentaje: 0, tope_mensual: 15000, monto_reintegro: 5000, compra_minima: 20000 }))
      .toEqual(promo)
  })
})
