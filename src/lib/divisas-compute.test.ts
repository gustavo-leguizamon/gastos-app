import { describe, it, expect } from 'vitest'
import {
  computeOperaciones,
  cotizacionVigente,
  parseCotizacionBody,
  parseOperacionBody,
  resumenDivisa,
  serieValorizada,
  toCotizacionResponse,
  toOperacionResponse,
} from './divisas-compute'
import type { CotizacionDivisa, OperacionDivisa } from './types'

let seq = 0
/** Operación con los defaults de una compra simple; cada test pisa lo que le importa. */
function op(o: Partial<OperacionDivisa> = {}): OperacionDivisa {
  seq++
  return {
    id: seq,
    fecha: '2026-01-01',
    tipo: 'compra',
    moneda_id: 2,
    moneda_codigo: 'USD',
    moneda_simbolo: 'US$',
    cantidad: 100,
    cotizacion: 1000,
    comision: 0,
    comision_moneda: 'ARS',
    plataforma: null,
    descripcion: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...o,
  }
}

const cot = (fecha: string, valor: number): CotizacionDivisa => ({
  id: 0,
  moneda_id: 2,
  fecha,
  valor,
  fuente: null,
})

describe('computeOperaciones — compra', () => {
  it('la comisión en pesos encarece cada unidad sin cambiar la cantidad', () => {
    const [c] = computeOperaciones([op({ cantidad: 100, cotizacion: 1000, comision: 5000 })])
    expect(c.divisa_neta).toBe(100)
    expect(c.ars_neto).toBe(-105000)
    expect(c.costo_delta).toBe(105000)
    // 1050, no 1000: la cotización pactada nunca es lo que realmente pagaste por dólar.
    expect(c.cotizacion_efectiva).toBe(1050)
    expect(c.tenencia).toBe(100)
    expect(c.costo_promedio).toBe(1050)
  })

  it('la comisión en divisa reduce los dólares que entran, no los pesos que salen', () => {
    const [c] = computeOperaciones([
      op({ cantidad: 100, cotizacion: 1000, comision: 1, comision_moneda: 'DIVISA' }),
    ])
    expect(c.divisa_neta).toBe(99)
    expect(c.ars_neto).toBe(-100000)
    expect(c.tenencia).toBe(99)
    expect(c.cotizacion_efectiva).toBe(1010.1)
  })

  it('lo comprado va al bucket de comprados y nada al de ganados', () => {
    const [c] = computeOperaciones([op()])
    expect(c.tenencia_comprada).toBe(100)
    expect(c.tenencia_ganada).toBe(0)
  })
})

describe('computeOperaciones — rendimiento', () => {
  it('suma tenencia con costo 0 y por eso baja el costo promedio', () => {
    const calc = computeOperaciones([
      op({ cantidad: 100, cotizacion: 1000 }),
      op({ tipo: 'rendimiento', cantidad: 10, cotizacion: null }),
    ])
    const r = calc[1]
    expect(r.costo_delta).toBe(0)
    expect(r.ars_neto).toBe(0)
    expect(r.tenencia).toBe(110)
    expect(r.costo_acumulado).toBe(100000)
    // Bajó de 1000: diez dólares que no costaron nada abaratan el promedio de toda la tenencia.
    expect(r.costo_promedio).toBe(909.09)
  })

  it('separa los ganados de los comprados', () => {
    const calc = computeOperaciones([
      op({ cantidad: 90 }),
      op({ tipo: 'rendimiento', cantidad: 10, cotizacion: null }),
    ])
    expect(calc[1].tenencia_comprada).toBe(90)
    expect(calc[1].tenencia_ganada).toBe(10)
  })

  it('sin precio de compra no hay cotización efectiva que informar', () => {
    const calc = computeOperaciones([op({ tipo: 'rendimiento', cantidad: 10, cotizacion: null })])
    expect(calc[0].cotizacion_efectiva).toBeNull()
  })
})

describe('computeOperaciones — venta', () => {
  it('realiza el resultado contra el costo promedio previo', () => {
    const calc = computeOperaciones([
      op({ cantidad: 100, cotizacion: 1000 }),
      op({ tipo: 'venta', cantidad: 50, cotizacion: 1500, comision: 3000 }),
    ])
    const v = calc[1]
    expect(v.ars_neto).toBe(72000)
    expect(v.costo_delta).toBe(-50000)
    expect(v.resultado).toBe(22000)
    expect(v.cotizacion_efectiva).toBe(1440)
    expect(v.tenencia).toBe(50)
    expect(v.costo_acumulado).toBe(50000)
    expect(v.costo_promedio).toBe(1000)
  })

  it('la comisión en divisa sale además de lo vendido', () => {
    const calc = computeOperaciones([
      op({ cantidad: 100, cotizacion: 1000 }),
      op({ tipo: 'venta', cantidad: 50, cotizacion: 1500, comision: 0.5, comision_moneda: 'DIVISA' }),
    ])
    const v = calc[1]
    expect(v.divisa_neta).toBe(-50.5)
    expect(v.tenencia).toBe(49.5)
    expect(v.ars_neto).toBe(75000)
    expect(v.resultado).toBe(24500)
  })

  it('drena comprados y ganados proporcionales al mix del momento', () => {
    const calc = computeOperaciones([
      op({ cantidad: 90, cotizacion: 1000 }),
      op({ tipo: 'rendimiento', cantidad: 10, cotizacion: null }),
      op({ tipo: 'venta', cantidad: 50, cotizacion: 1200 }),
    ])
    const v = calc[2]
    // 90/10 antes de vender la mitad ⇒ 45/5 después: la proporción no se toca.
    expect(v.tenencia_comprada).toBe(45)
    expect(v.tenencia_ganada).toBe(5)
    expect(v.tenencia).toBe(50)
    expect(v.resultado).toBe(15000)
  })

  it('vender más de lo que hay no deja costo negativo y se ve en la tenencia', () => {
    const calc = computeOperaciones([
      op({ cantidad: 10, cotizacion: 1000 }),
      op({ tipo: 'venta', cantidad: 15, cotizacion: 1200 }),
    ])
    const v = calc[1]
    expect(v.tenencia).toBe(-5)
    expect(v.costo_acumulado).toBe(0)
    expect(v.costo_promedio).toBeNull()
    // Se libera todo el costo que había, no más.
    expect(v.resultado).toBe(8000)
    // La invariante se mantiene incluso con el dato inconsistente.
    expect(v.tenencia_comprada + v.tenencia_ganada).toBe(v.tenencia)
  })
})

describe('computeOperaciones — egreso', () => {
  it('saca la divisa y su costo sin pesos de por medio', () => {
    const calc = computeOperaciones([
      op({ cantidad: 100, cotizacion: 1000 }),
      op({ tipo: 'egreso', cantidad: 20, cotizacion: null }),
    ])
    const e = calc[1]
    expect(e.ars_neto).toBe(0)
    expect(e.costo_delta).toBe(-20000)
    expect(e.tenencia).toBe(80)
    expect(e.costo_acumulado).toBe(80000)
  })

  it('sin cotización no hay resultado: no hay contra qué medirlo', () => {
    const calc = computeOperaciones([
      op({ cantidad: 100, cotizacion: 1000 }),
      op({ tipo: 'egreso', cantidad: 20, cotizacion: null }),
    ])
    expect(calc[1].resultado).toBeNull()
    expect(calc[1].cotizacion_efectiva).toBeNull()
  })

  it('con cotización de referencia mide cuánto valía lo que salió', () => {
    const calc = computeOperaciones([
      op({ cantidad: 100, cotizacion: 1000 }),
      op({ tipo: 'egreso', cantidad: 20, cotizacion: 1500 }),
    ])
    expect(calc[1].resultado).toBe(10000)
    expect(calc[1].cotizacion_efectiva).toBe(1500)
    // Sigue sin entrar un peso a la cuenta.
    expect(calc[1].ars_neto).toBe(0)
  })
})

describe('computeOperaciones — casos borde', () => {
  it('sin operaciones devuelve la lista vacía', () => {
    expect(computeOperaciones([])).toEqual([])
  })

  it('conserva los campos de la operación original', () => {
    const [c] = computeOperaciones([op({ plataforma: 'Broker X', descripcion: 'primera compra' })])
    expect(c.plataforma).toBe('Broker X')
    expect(c.descripcion).toBe('primera compra')
    expect(c.moneda_codigo).toBe('USD')
  })
})

describe('resumenDivisa', () => {
  const ops = [
    op({ cantidad: 100, cotizacion: 1000, comision: 1000 }),
    op({ tipo: 'rendimiento', cantidad: 10, cotizacion: null }),
    op({ tipo: 'venta', cantidad: 50, cotizacion: 1500, comision: 500 }),
  ]

  it('separa la tenencia comprada de la ganada', () => {
    const r = resumenDivisa(ops, 1600)
    expect(r.tenencia).toBe(60)
    expect(r.tenencia_comprada).toBe(54.54545455)
    expect(r.tenencia_ganada).toBe(5.45454545)
    expect(r.ganada_pct).toBe(9.09)
  })

  it('informa los pesos invertidos, los recuperados y lo ya realizado', () => {
    const r = resumenDivisa(ops, 1600)
    expect(r.ars_invertido).toBe(101000)
    expect(r.ars_recuperado).toBe(74500)
    expect(r.resultado_realizado).toBe(28590.91)
  })

  it('valúa la tenencia y separa lo no realizado de lo realizado', () => {
    const r = resumenDivisa(ops, 1600)
    expect(r.costo_total).toBe(55090.91)
    expect(r.valor_actual).toBe(96000)
    expect(r.resultado_no_realizado).toBe(40909.09)
    expect(r.resultado_total).toBe(69500)
    expect(r.resultado_pct).toBe(74.26)
  })

  it('sin cotización no inventa un valor para la tenencia', () => {
    const r = resumenDivisa(ops, null)
    expect(r.cotizacion_actual).toBeNull()
    expect(r.valor_actual).toBeNull()
    expect(r.resultado_no_realizado).toBeNull()
    expect(r.resultado_total).toBeNull()
    expect(r.resultado_pct).toBeNull()
    // Lo ya realizado no depende de la cotización de hoy y se sigue informando.
    expect(r.resultado_realizado).toBe(28590.91)
  })

  it('cuenta las comisiones por separado según la moneda en que se cobraron', () => {
    const r = resumenDivisa(
      [op({ comision: 1000 }), op({ tipo: 'venta', cantidad: 10, cotizacion: 1200, comision: 0.2, comision_moneda: 'DIVISA' })],
      1200,
    )
    expect(r.comision_ars).toBe(1000)
    expect(r.comision_divisa).toBe(0.2)
  })

  it('sin operaciones devuelve la posición vacía', () => {
    const r = resumenDivisa([], 1500)
    expect(r.tenencia).toBe(0)
    expect(r.costo_total).toBe(0)
    expect(r.costo_promedio).toBeNull()
    expect(r.ganada_pct).toBeNull()
    expect(r.cantidad).toBe(0)
    // Sin costo no hay porcentaje que calcular, aunque haya cotización.
    expect(r.resultado_pct).toBeNull()
  })

  it('una tenencia enteramente ganada no tiene porcentaje de rendimiento', () => {
    const r = resumenDivisa([op({ tipo: 'rendimiento', cantidad: 10, cotizacion: null })], 1500)
    expect(r.costo_total).toBe(0)
    expect(r.valor_actual).toBe(15000)
    expect(r.resultado_no_realizado).toBe(15000)
    expect(r.resultado_pct).toBeNull()
  })
})

describe('cotizacionVigente', () => {
  const cots = [cot('2026-01-01', 1000), cot('2026-03-01', 1200)]

  it('sin fecha devuelve la última cargada', () => {
    expect(cotizacionVigente(cots)?.valor).toBe(1200)
  })

  it('con fecha devuelve la última en o antes de esa fecha', () => {
    expect(cotizacionVigente(cots, '2026-02-01')?.valor).toBe(1000)
    expect(cotizacionVigente(cots, '2026-03-01')?.valor).toBe(1200)
  })

  it('no usa una cotización posterior a la fecha pedida', () => {
    expect(cotizacionVigente(cots, '2025-12-01')).toBeNull()
  })

  it('sin cotizaciones devuelve null', () => {
    expect(cotizacionVigente([])).toBeNull()
  })
})

describe('serieValorizada', () => {
  it('pone un punto por cada fecha en la que se movió el costo o el valor', () => {
    const serie = serieValorizada(
      [op({ fecha: '2026-01-10', cantidad: 100, cotizacion: 1000 })],
      [cot('2026-01-05', 900), cot('2026-02-01', 1100)],
    )
    expect(serie.map((p) => p.fecha)).toEqual(['2026-01-05', '2026-01-10', '2026-02-01'])
  })

  it('antes de la primera operación la tenencia es 0 y el valor también', () => {
    const serie = serieValorizada(
      [op({ fecha: '2026-01-10', cantidad: 100, cotizacion: 1000 })],
      [cot('2026-01-05', 900), cot('2026-02-01', 1100)],
    )
    expect(serie[0]).toEqual({ fecha: '2026-01-05', tenencia: 0, costo: 0, valor: 0 })
  })

  it('valúa con la última cotización vigente, que se arrastra hasta la siguiente', () => {
    const serie = serieValorizada(
      [op({ fecha: '2026-01-10', cantidad: 100, cotizacion: 1000 })],
      [cot('2026-01-05', 900), cot('2026-02-01', 1100)],
    )
    expect(serie[1]).toEqual({ fecha: '2026-01-10', tenencia: 100, costo: 100000, valor: 90000 })
    expect(serie[2]).toEqual({ fecha: '2026-02-01', tenencia: 100, costo: 100000, valor: 110000 })
  })

  it('sin cotización todavía cargada el valor queda en null en vez de inventarse', () => {
    const serie = serieValorizada(
      [op({ fecha: '2026-01-10', cantidad: 100, cotizacion: 1000 })],
      [cot('2026-02-01', 1100)],
    )
    expect(serie[0]).toEqual({ fecha: '2026-01-10', tenencia: 100, costo: 100000, valor: null })
  })

  it('el punto del día refleja la última operación de esa fecha', () => {
    const serie = serieValorizada(
      [
        op({ fecha: '2026-01-10', cantidad: 100, cotizacion: 1000 }),
        op({ fecha: '2026-01-10', cantidad: 50, cotizacion: 1000 }),
      ],
      [cot('2026-01-10', 1000)],
    )
    expect(serie).toHaveLength(1)
    expect(serie[0].tenencia).toBe(150)
    expect(serie[0].costo).toBe(150000)
  })

  it('sin datos devuelve una serie vacía', () => {
    expect(serieValorizada([], [])).toEqual([])
  })
})

describe('parseOperacionBody', () => {
  const valido = {
    fecha: '2026-01-10',
    tipo: 'compra',
    moneda_id: 2,
    cantidad: 100,
    cotizacion: 1000,
    comision: 5000,
  }

  it('normaliza el body a camelCase con los defaults', () => {
    expect(parseOperacionBody(valido)).toEqual({
      fecha: '2026-01-10',
      tipo: 'compra',
      monedaId: 2,
      cantidad: 100,
      cotizacion: 1000,
      comision: 5000,
      comisionMoneda: 'ARS',
      plataforma: null,
      descripcion: null,
    })
  })

  it('exige cotización en compra y en venta', () => {
    expect(parseOperacionBody({ ...valido, cotizacion: null })).toBeNull()
    expect(parseOperacionBody({ ...valido, tipo: 'venta', cotizacion: undefined })).toBeNull()
  })

  it('acepta rendimiento y egreso sin cotización', () => {
    expect(parseOperacionBody({ ...valido, tipo: 'rendimiento', cotizacion: null })).toMatchObject({
      tipo: 'rendimiento',
      cotizacion: null,
    })
    expect(parseOperacionBody({ ...valido, tipo: 'egreso', cotizacion: '' })).toMatchObject({
      tipo: 'egreso',
      cotizacion: null,
    })
  })

  it('rechaza una cantidad que no sea positiva: la dirección la da el tipo', () => {
    expect(parseOperacionBody({ ...valido, cantidad: 0 })).toBeNull()
    expect(parseOperacionBody({ ...valido, cantidad: -100 })).toBeNull()
    expect(parseOperacionBody({ ...valido, cantidad: 'diez' })).toBeNull()
  })

  it('rechaza una comisión negativa y toma 0 por defecto', () => {
    expect(parseOperacionBody({ ...valido, comision: -1 })).toBeNull()
    expect(parseOperacionBody({ ...valido, comision: undefined })?.comision).toBe(0)
    expect(parseOperacionBody({ ...valido, comision: '' })?.comision).toBe(0)
  })

  it('sólo acepta DIVISA como moneda de comisión alternativa; el resto cae en ARS', () => {
    expect(parseOperacionBody({ ...valido, comision_moneda: 'DIVISA' })?.comisionMoneda).toBe('DIVISA')
    expect(parseOperacionBody({ ...valido, comision_moneda: 'USD' })?.comisionMoneda).toBe('ARS')
    expect(parseOperacionBody({ ...valido, comision_moneda: null })?.comisionMoneda).toBe('ARS')
  })

  it('rechaza fecha, tipo o moneda inválidos', () => {
    expect(parseOperacionBody({ ...valido, fecha: '10/01/2026' })).toBeNull()
    expect(parseOperacionBody({ ...valido, fecha: '2026-13-10' })).toBeNull()
    expect(parseOperacionBody({ ...valido, tipo: 'transferencia' })).toBeNull()
    expect(parseOperacionBody({ ...valido, moneda_id: 0 })).toBeNull()
    expect(parseOperacionBody({ ...valido, moneda_id: 1.5 })).toBeNull()
    expect(parseOperacionBody(null)).toBeNull()
  })

  it('rechaza una cotización que no sea positiva', () => {
    expect(parseOperacionBody({ ...valido, cotizacion: 0 })).toBeNull()
    expect(parseOperacionBody({ ...valido, cotizacion: -1000 })).toBeNull()
  })

  it('trimea plataforma y descripción, y guarda null en vez de texto vacío', () => {
    const d = parseOperacionBody({ ...valido, plataforma: '  Broker X  ', descripcion: '   ' })
    expect(d?.plataforma).toBe('Broker X')
    expect(d?.descripcion).toBeNull()
  })
})

describe('parseCotizacionBody', () => {
  it('normaliza el body a camelCase', () => {
    expect(parseCotizacionBody({ moneda_id: 2, fecha: '2026-01-10', valor: 1450, fuente: ' MEP ' })).toEqual({
      monedaId: 2,
      fecha: '2026-01-10',
      valor: 1450,
      fuente: 'MEP',
    })
  })

  it('rechaza valores no positivos y fechas mal formadas', () => {
    expect(parseCotizacionBody({ moneda_id: 2, fecha: '2026-01-10', valor: 0 })).toBeNull()
    expect(parseCotizacionBody({ moneda_id: 2, fecha: '2026-01-10', valor: -5 })).toBeNull()
    expect(parseCotizacionBody({ moneda_id: 2, fecha: 'ayer', valor: 1450 })).toBeNull()
    expect(parseCotizacionBody({ moneda_id: 0, fecha: '2026-01-10', valor: 1450 })).toBeNull()
    expect(parseCotizacionBody(undefined)).toBeNull()
  })

  it('una fuente vacía se guarda como null', () => {
    expect(parseCotizacionBody({ moneda_id: 2, fecha: '2026-01-10', valor: 1450, fuente: '' })?.fuente).toBeNull()
  })
})

describe('mapping de respuestas', () => {
  it('toOperacionResponse pasa a snake_case y serializa las fechas', () => {
    expect(
      toOperacionResponse({
        id: 7,
        fecha: '2026-01-10',
        tipo: 'compra',
        monedaId: 2,
        moneda: { codigo: 'USD', simbolo: 'US$' },
        cantidad: 100,
        cotizacion: 1000,
        comision: 5000,
        comisionMoneda: 'ARS',
        plataforma: 'Broker X',
        descripcion: null,
        createdAt: new Date('2026-01-10T12:00:00Z'),
        updatedAt: new Date('2026-01-10T12:00:00Z'),
      }),
    ).toEqual({
      id: 7,
      fecha: '2026-01-10',
      tipo: 'compra',
      moneda_id: 2,
      moneda_codigo: 'USD',
      moneda_simbolo: 'US$',
      cantidad: 100,
      cotizacion: 1000,
      comision: 5000,
      comision_moneda: 'ARS',
      plataforma: 'Broker X',
      descripcion: null,
      created_at: '2026-01-10T12:00:00.000Z',
      updated_at: '2026-01-10T12:00:00.000Z',
    })
  })

  it('toOperacionResponse normaliza una moneda de comisión inesperada a ARS', () => {
    const row = {
      id: 1,
      fecha: '2026-01-10',
      tipo: 'compra',
      monedaId: 2,
      cantidad: 1,
      cotizacion: 1,
      comision: 0,
      comisionMoneda: 'lo-que-sea',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(toOperacionResponse(row).comision_moneda).toBe('ARS')
    expect(toOperacionResponse(row).moneda_codigo).toBeNull()
  })

  it('toCotizacionResponse pasa a snake_case', () => {
    expect(toCotizacionResponse({ id: 3, monedaId: 2, fecha: '2026-01-10', valor: 1450, fuente: null })).toEqual({
      id: 3,
      moneda_id: 2,
      fecha: '2026-01-10',
      valor: 1450,
      fuente: null,
    })
  })
})
