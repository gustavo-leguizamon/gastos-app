import { describe, it, expect } from 'vitest'
import { toGastoResponse } from './gastos-compute'

// Fábrica de un row crudo de Prisma (camelCase) con valores por defecto razonables.
// Cada test sobreescribe sólo lo que le importa.
function makeGasto(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    casaId: 10,
    conceptoId: 1,
    concepto: { id: 1, nombre: 'Internet' },
    fechaVencimiento: '2026-06-10',
    tipoPago: 'D',
    monedaId: 2,
    tipoCambio: 1,
    totalMoneda: 1000,
    pasajeMesSiguiente: 0,
    prestamo_a_otro: 0,
    tarjetaId: null,
    etiquetas: [],
    cuotaActual: null,
    cuotasTotales: null,
    mes: 6,
    anio: 2026,
    notas: null,
    confirmado: true,
    esTarjeta: false,
    createdAt: new Date('2026-06-01T00:00:00Z'),
    updatedAt: new Date('2026-06-02T00:00:00Z'),
    pagos: [],
    items: [],
    ...overrides,
  }
}

describe('toGastoResponse', () => {
  it('mapea campos camelCase → snake_case', () => {
    const r = toGastoResponse(makeGasto({ casaId: 7, tipoPago: 'C', pasajeMesSiguiente: 50, prestamo_a_otro: 30 }))
    expect(r.casa_id).toBe(7)
    expect(r.tipo_pago).toBe('C')
    expect(r.pasaje_mes_siguiente).toBe(50)
    expect(r.prestamo_a_otro).toBe(30)
    expect(r.es_tarjeta).toBe(false)
  })

  it('deriva descripcion y concepto_id del concepto relacionado', () => {
    const r = toGastoResponse(makeGasto({ conceptoId: 42, concepto: { id: 42, nombre: 'Netflix' } }))
    expect(r.concepto_id).toBe(42)
    expect(r.descripcion).toBe('Netflix')
  })

  it('calcula total_ars = totalMoneda * tipoCambio redondeado a 2 decimales', () => {
    const r = toGastoResponse(makeGasto({ totalMoneda: 100, tipoCambio: 1234.567 }))
    expect(r.total_ars).toBe(123456.7)
  })

  it('redondea total_ars correctamente en el medio decimal', () => {
    // 10 * 0.005 = 0.05 → tras *100 = 5 exacto; usamos un caso con redondeo real
    const r = toGastoResponse(makeGasto({ totalMoneda: 3, tipoCambio: 0.3333 }))
    expect(r.total_ars).toBe(1) // 0.9999 → 1.00
  })

  it('total_pagado es la suma de pagos, total_restante = total_ars - total_pagado', () => {
    const r = toGastoResponse(makeGasto({
      totalMoneda: 1000,
      tipoCambio: 1,
      pagos: [
        { id: 1, gastoId: 1, fecha: '2026-06-05', monto: 300, createdAt: new Date('2026-06-05T00:00:00Z') },
        { id: 2, gastoId: 1, fecha: '2026-06-06', monto: 200.5, createdAt: new Date('2026-06-06T00:00:00Z') },
      ],
    }))
    expect(r.total_pagado).toBe(500.5)
    expect(r.total_restante).toBe(499.5)
    expect(r.pagos).toHaveLength(2)
    expect(r.pagos[0]).toMatchObject({ id: 1, gasto_id: 1, monto: 300 })
  })

  it('con pagos vacíos: total_pagado 0 y total_restante = total_ars', () => {
    const r = toGastoResponse(makeGasto({ totalMoneda: 800, tipoCambio: 1 }))
    expect(r.total_pagado).toBe(0)
    expect(r.total_restante).toBe(800)
  })

  it('resuelve el cierre de tarjeta que coincide con mes/anio del gasto', () => {
    const r = toGastoResponse(makeGasto({
      mes: 6,
      anio: 2026,
      tarjetaId: 5,
      tarjeta: {
        nombre: 'Visa Gold',
        banco: 'Galicia',
        marca: 'visa',
        cierres: [
          { mes: 5, anio: 2026, fechaCierre: '2026-05-20', fechaVencimiento: '2026-05-28', fechaProximoCierre: null },
          { mes: 6, anio: 2026, fechaCierre: '2026-06-20', fechaVencimiento: '2026-06-28', fechaProximoCierre: '2026-07-20' },
        ],
      },
    }))
    expect(r.tarjeta_nombre).toBe('Visa Gold')
    expect(r.tarjeta_marca).toBe('visa')
    expect(r.cierre).toEqual({
      fecha_cierre: '2026-06-20',
      fecha_vencimiento: '2026-06-28',
      fecha_proximo_cierre: '2026-07-20',
    })
  })

  it('cierre es null cuando no hay tarjeta o no matchea el mes/anio', () => {
    expect(toGastoResponse(makeGasto()).cierre).toBeNull()
    const r = toGastoResponse(makeGasto({
      mes: 6, anio: 2026, tarjetaId: 5,
      tarjeta: { nombre: 'X', cierres: [{ mes: 1, anio: 2026 }] },
    }))
    expect(r.cierre).toBeNull()
  })

  it('mapea sub-items a snake_case con sus flags y categorías', () => {
    const r = toGastoResponse(makeGasto({
      items: [{
        id: 9, gastoId: 1, conceptoId: 9, concepto: { id: 9, nombre: 'Nafta' }, monto: 250, fecha: '2026-06-03',
        cuotaActual: 2, cuotasTotales: 6, incluyeEnTotal: true, incluyeEnVencimiento: false,
        verificado: true, etiquetas: [{ id: 3, nombre: 'Auto' }, { id: 5, nombre: 'Combustible' }],
        createdAt: new Date('2026-06-03T00:00:00Z'),
      }],
    }))
    expect(r.items).toHaveLength(1)
    expect(r.items[0]).toMatchObject({
      id: 9, gasto_id: 1, concepto_id: 9, descripcion: 'Nafta', monto: 250, fecha: '2026-06-03',
      cuota_actual: 2, cuotas_totales: 6, incluye_en_total: true, incluye_en_vencimiento: false,
      verificado: true, etiqueta_ids: [3, 5],
    })
    expect(r.items[0].etiquetas).toEqual([{ id: 3, nombre: 'Auto' }, { id: 5, nombre: 'Combustible' }])
  })

  it('serializa created_at/updated_at a ISO string', () => {
    const r = toGastoResponse(makeGasto())
    expect(r.created_at).toBe('2026-06-01T00:00:00.000Z')
    expect(r.updated_at).toBe('2026-06-02T00:00:00.000Z')
  })
})
