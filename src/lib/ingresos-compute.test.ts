import { describe, it, expect } from 'vitest'
import {
  mesAnioDeFecha,
  parseIngresoBody,
  buildIngresosWhere,
  toIngresoResponse,
  montoArs,
  sumIngresos,
  sumMontosArs,
  computeAhorro,
} from './ingresos-compute'

describe('mesAnioDeFecha', () => {
  it('parsea la fecha como string, sin correr el día por timezone', () => {
    // `new Date('2026-08-01').getMonth()` daría julio en UTC-3; el parseo por string no.
    expect(mesAnioDeFecha('2026-08-01')).toEqual({ mes: 8, anio: 2026 })
    expect(mesAnioDeFecha('2026-12-31')).toEqual({ mes: 12, anio: 2026 })
  })

  it('rechaza formatos y rangos inválidos', () => {
    for (const v of ['', '2026-8-1', '2026/08/01', '2026-13-01', '2026-00-10', '2026-08-32', 20260801, null, undefined]) {
      expect(mesAnioDeFecha(v as any)).toBeNull()
    }
  })
})

describe('parseIngresoBody', () => {
  // Body mínimo válido: el caso normal es un ingreso en ARS (tipo de cambio 1).
  const ars = { fecha: '2026-08-05', monto_moneda: 1, moneda_id: 1 }

  it('normaliza el body a camelCase derivando mes/anio de la fecha', () => {
    expect(parseIngresoBody({ ...ars, monto_moneda: '150000.5', descripcion: '  Sueldo  ' })).toEqual({
      fecha: '2026-08-05',
      mes: 8,
      anio: 2026,
      monedaId: 1,
      tipoCambio: 1,
      montoMoneda: 150000.5,
      descripcion: 'Sueldo',
      casaId: null,
    })
  })

  it('sin tipo_cambio asume 1 — el ingreso en ARS no necesita conversión', () => {
    expect(parseIngresoBody(ars)?.tipoCambio).toBe(1)
  })

  it('acepta una moneda distinta con su tipo de cambio', () => {
    const d = parseIngresoBody({ ...ars, moneda_id: 2, monto_moneda: 100, tipo_cambio: 1350.5 })
    expect(d).toMatchObject({ monedaId: 2, montoMoneda: 100, tipoCambio: 1350.5 })
  })

  it('respeta mes/anio explícitos para imputar un cobro a otro mes', () => {
    const d = parseIngresoBody({ ...ars, fecha: '2026-07-31', mes: 8, anio: 2026 })
    expect(d).toMatchObject({ fecha: '2026-07-31', mes: 8, anio: 2026 })
  })

  it('deja la descripción en null cuando viene vacía o no es texto', () => {
    expect(parseIngresoBody({ ...ars, descripcion: '   ' })?.descripcion).toBeNull()
    expect(parseIngresoBody(ars)?.descripcion).toBeNull()
    expect(parseIngresoBody({ ...ars, descripcion: 42 })?.descripcion).toBeNull()
  })

  it('acepta montos negativos (corrección de un ingreso cargado de más)', () => {
    expect(parseIngresoBody({ ...ars, monto_moneda: -5000 })?.montoMoneda).toBe(-5000)
  })

  it('acepta casa_id entero y lo mapea a casaId', () => {
    expect(parseIngresoBody({ ...ars, casa_id: 3 })?.casaId).toBe(3)
    expect(parseIngresoBody({ ...ars, casa_id: null })?.casaId).toBeNull()
  })

  it('rechaza bodies inválidos', () => {
    const invalidos = [
      null,
      'texto',
      { monto_moneda: 100, moneda_id: 1 },                   // sin fecha
      { ...ars, fecha: '05/08/2026' },                       // fecha mal formada
      { fecha: '2026-08-05', moneda_id: 1 },                 // sin monto
      { ...ars, monto_moneda: 'abc' },                       // monto no numérico
      { fecha: '2026-08-05', monto_moneda: 100 },            // sin moneda
      { ...ars, moneda_id: 0 },                              // moneda inválida
      { ...ars, moneda_id: 1.5 },
      { ...ars, tipo_cambio: 0 },                            // tipo de cambio <= 0
      { ...ars, tipo_cambio: -3 },
      { ...ars, tipo_cambio: 'abc' },
      { ...ars, mes: 13 },                                   // mes fuera de rango
      { ...ars, mes: 1.5 },                                  // mes no entero
      { ...ars, anio: 12 },                                  // año absurdo
      { ...ars, casa_id: 0 },                                // casa inválida
      { ...ars, casa_id: 'x' },
    ]
    for (const b of invalidos) expect(parseIngresoBody(b as any)).toBeNull()
  })
})

describe('buildIngresosWhere', () => {
  it('filtra por mes y año', () => {
    expect(buildIngresosWhere(8, 2026, null)).toEqual({ mes: 8, anio: 2026 })
  })

  it('coerciona los query params string a number', () => {
    expect(buildIngresosWhere('8', '2026', null)).toEqual({ mes: 8, anio: 2026 })
  })

  it('al filtrar por casa incluye también los ingresos sin casa', () => {
    expect(buildIngresosWhere(8, 2026, 3)).toEqual({
      mes: 8,
      anio: 2026,
      OR: [{ casaId: 3 }, { casaId: null }],
    })
  })

  it('sin filtros devuelve un where vacío', () => {
    expect(buildIngresosWhere(null, null, null)).toEqual({})
    expect(buildIngresosWhere('', '', '')).toEqual({})
  })
})

describe('montoArs', () => {
  it('en ARS el tipo de cambio es 1 y el monto no cambia', () => {
    expect(montoArs({ montoMoneda: 150000, tipoCambio: 1 })).toBe(150000)
  })

  it('convierte con el tipo de cambio cuando la moneda no es ARS', () => {
    expect(montoArs({ montoMoneda: 100, tipoCambio: 1350.5 })).toBe(135050)
  })

  it('redondea a 2 decimales', () => {
    expect(montoArs({ montoMoneda: 33.333, tipoCambio: 3 })).toBe(100)
  })
})

describe('toIngresoResponse', () => {
  const base = {
    id: 7,
    fecha: '2026-08-05',
    mes: 8,
    anio: 2026,
    monedaId: 1,
    tipoCambio: 1,
    montoMoneda: 150000,
    moneda: { id: 1, codigo: 'ARS', simbolo: '$' },
    descripcion: 'Sueldo',
    casaId: 2,
    casa: { id: 2, nombre: 'Casa' },
    createdAt: new Date('2026-08-05T10:00:00Z'),
    updatedAt: new Date('2026-08-06T11:00:00Z'),
  }

  it('mapea camelCase a snake_case con la casa y la moneda', () => {
    expect(toIngresoResponse(base)).toEqual({
      id: 7,
      fecha: '2026-08-05',
      mes: 8,
      anio: 2026,
      moneda_id: 1,
      moneda_codigo: 'ARS',
      moneda_simbolo: '$',
      tipo_cambio: 1,
      monto_moneda: 150000,
      monto_ars: 150000,
      descripcion: 'Sueldo',
      casa_id: 2,
      casa_nombre: 'Casa',
      created_at: '2026-08-05T10:00:00.000Z',
      updated_at: '2026-08-06T11:00:00.000Z',
    })
  })

  it('deriva monto_ars con el tipo de cambio en moneda extranjera', () => {
    const r = toIngresoResponse({
      ...base,
      monedaId: 2,
      tipoCambio: 1350,
      montoMoneda: 1000,
      moneda: { id: 2, codigo: 'USD', simbolo: 'US$' },
    })
    expect(r).toMatchObject({ moneda_codigo: 'USD', monto_moneda: 1000, tipo_cambio: 1350, monto_ars: 1350000 })
  })

  it('un ingreso general (sin casa) expone casa_id y casa_nombre en null', () => {
    const r = toIngresoResponse({ ...base, casaId: null, casa: null, descripcion: null })
    expect(r).toMatchObject({ casa_id: null, casa_nombre: null, descripcion: null })
  })
})

describe('sumIngresos', () => {
  it('suma todas las entradas del mes', () => {
    expect(sumIngresos([
      { montoMoneda: 100000, tipoCambio: 1 },
      { montoMoneda: 50000, tipoCambio: 1 },
      { montoMoneda: 1234.56, tipoCambio: 1 },
    ])).toBe(151234.56)
  })

  it('lleva cada entrada a ARS antes de sumar', () => {
    // 100 USD a 1350 + 50.000 ARS
    expect(sumIngresos([
      { montoMoneda: 100, tipoCambio: 1350 },
      { montoMoneda: 50000, tipoCambio: 1 },
    ])).toBe(185000)
  })

  it('sin ingresos da 0', () => {
    expect(sumIngresos([])).toBe(0)
  })

  it('redondea a 2 decimales', () => {
    expect(sumIngresos([{ montoMoneda: 0.1, tipoCambio: 1 }, { montoMoneda: 0.2, tipoCambio: 1 }])).toBe(0.3)
  })
})

describe('sumMontosArs', () => {
  it('suma el monto ya convertido que trae la respuesta de la API', () => {
    expect(sumMontosArs([{ monto_ars: 150000 }, { monto_ars: 1350000 }])).toBe(1500000)
  })

  it('sin ingresos da 0', () => {
    expect(sumMontosArs([])).toBe(0)
  })

  it('redondea a 2 decimales', () => {
    expect(sumMontosArs([{ monto_ars: 0.1 }, { monto_ars: 0.2 }])).toBe(0.3)
  })
})

describe('computeAhorro', () => {
  const ars = (monto: number) => ({ montoMoneda: monto, tipoCambio: 1 })

  it('resta lo gastado en débito/efectivo', () => {
    expect(computeAhorro([ars(1500000)], 900000)).toEqual({
      total_ingresos: 1500000,
      ahorro: 600000,
      ahorro_pct: 40,
    })
  })

  it('suma varios ingresos del mes antes de comparar', () => {
    const r = computeAhorro([ars(600000), ars(400000), ars(500000)], 900000)
    expect(r.total_ingresos).toBe(1500000)
    expect(r.ahorro).toBe(600000)
  })

  it('compara contra el total convertido a ARS, no contra el monto en moneda', () => {
    // 1000 USD a 1350 = 1.350.000 ARS; débito 350.000 → ahorro 1.000.000
    const r = computeAhorro([{ montoMoneda: 1000, tipoCambio: 1350 }], 350000)
    expect(r.total_ingresos).toBe(1350000)
    expect(r.ahorro).toBe(1000000)
  })

  it('da ahorro negativo cuando se gastó más de lo que entró', () => {
    const r = computeAhorro([ars(100000)], 150000)
    expect(r.ahorro).toBe(-50000)
    expect(r.ahorro_pct).toBe(-50)
  })

  it('sin ingresos cargados no calcula porcentaje', () => {
    expect(computeAhorro([], 50000)).toEqual({ total_ingresos: 0, ahorro: -50000, ahorro_pct: 0 })
  })

  it('redondea ahorro y porcentaje a 2 decimales', () => {
    const r = computeAhorro([ars(3000)], 1000)
    expect(r.ahorro_pct).toBe(66.67)
  })
})
