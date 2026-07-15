import { describe, it, expect } from 'vitest'
import { enumerateMonths, computeReportes } from './reportes-compute'

function gasto(overrides: Record<string, any> = {}) {
  return {
    conceptoId: 1,
    concepto: { id: 1, nombre: 'Internet' },
    totalMoneda: 1000,
    tipoCambio: 1,
    confirmado: true,
    categorias: [],
    items: [],
    mes: 6,
    anio: 2026,
    ...overrides,
  }
}

describe('enumerateMonths', () => {
  it('enumera un rango dentro del mismo año, cronológico e inclusive', () => {
    expect(enumerateMonths(4, 2026, 7, 2026)).toEqual([
      { mes: 4, anio: 2026 },
      { mes: 5, anio: 2026 },
      { mes: 6, anio: 2026 },
      { mes: 7, anio: 2026 },
    ])
  })

  it('maneja el wraparound de año', () => {
    expect(enumerateMonths(11, 2025, 2, 2026)).toEqual([
      { mes: 11, anio: 2025 },
      { mes: 12, anio: 2025 },
      { mes: 1, anio: 2026 },
      { mes: 2, anio: 2026 },
    ])
  })

  it('endereza un rango invertido', () => {
    expect(enumerateMonths(7, 2026, 4, 2026)).toEqual([
      { mes: 4, anio: 2026 },
      { mes: 5, anio: 2026 },
      { mes: 6, anio: 2026 },
      { mes: 7, anio: 2026 },
    ])
  })

  it('un solo mes cuando desde === hasta', () => {
    expect(enumerateMonths(6, 2026, 6, 2026)).toEqual([{ mes: 6, anio: 2026 }])
  })

  it('acota a 60 meses recortando desde el inicio', () => {
    const r = enumerateMonths(1, 2000, 12, 2010) // 132 meses
    expect(r).toHaveLength(60)
    expect(r[r.length - 1]).toEqual({ mes: 12, anio: 2010 })
  })
})

describe('computeReportes', () => {
  const months = enumerateMonths(5, 2026, 7, 2026)

  it('suma el total ARS y calcula el promedio mensual sobre la cantidad de meses', () => {
    const r = computeReportes(
      [gasto({ mes: 5, totalMoneda: 100 }), gasto({ mes: 6, totalMoneda: 200 }), gasto({ mes: 7, totalMoneda: 300 })],
      months,
    )
    expect(r.kpis.total).toBe(600)
    expect(r.kpis.meses).toBe(3)
    expect(r.kpis.promedio_mensual).toBe(200)
    expect(r.kpis.cantidad_gastos).toBe(3)
  })

  it('usa tipoCambio para el total ARS', () => {
    const r = computeReportes([gasto({ totalMoneda: 100, tipoCambio: 1500 })], months)
    expect(r.kpis.total).toBe(150000)
  })

  it('atribuye el monto COMPLETO a cada categoría del gasto (overlap)', () => {
    const r = computeReportes(
      [gasto({ totalMoneda: 1000, categorias: [{ id: 1, nombre: 'Auto' }, { id: 2, nombre: 'Super' }] })],
      months,
    )
    const auto = r.por_categoria.find((c) => c.id === 1)
    const super_ = r.por_categoria.find((c) => c.id === 2)
    expect(auto?.total_ars).toBe(1000)
    expect(super_?.total_ars).toBe(1000)
    // el total del KPI cuenta el gasto una sola vez
    expect(r.kpis.total).toBe(1000)
  })

  it('agrupa los gastos sin categoría en "Sin categoría" (id null)', () => {
    const r = computeReportes([gasto({ totalMoneda: 500, categorias: [] })], months)
    const sin = r.por_categoria.find((c) => c.id === null)
    expect(sin?.nombre).toBe('Sin categoría')
    expect(sin?.total_ars).toBe(500)
  })

  it('agrega por mes y deja en 0 los meses sin gastos', () => {
    const r = computeReportes([gasto({ mes: 5, totalMoneda: 100 }), gasto({ mes: 7, totalMoneda: 300 })], months)
    expect(r.por_mes.map((m) => m.total_ars)).toEqual([100, 0, 300])
    expect(r.por_mes[0].label).toBe('May 26')
  })

  it('rankea conceptos desc y respeta el límite topConceptos', () => {
    const gastos = [
      gasto({ conceptoId: 1, concepto: { id: 1, nombre: 'A' }, totalMoneda: 100 }),
      gasto({ conceptoId: 2, concepto: { id: 2, nombre: 'B' }, totalMoneda: 300 }),
      gasto({ conceptoId: 3, concepto: { id: 3, nombre: 'C' }, totalMoneda: 200 }),
    ]
    const r = computeReportes(gastos, months, { topConceptos: 2 })
    expect(r.top_conceptos.map((c) => c.nombre)).toEqual(['B', 'C'])
  })

  it('suma el mismo concepto a través de meses', () => {
    const r = computeReportes(
      [gasto({ mes: 5, totalMoneda: 100 }), gasto({ mes: 6, totalMoneda: 150 })],
      months,
    )
    expect(r.top_conceptos).toHaveLength(1)
    expect(r.top_conceptos[0].total_ars).toBe(250)
  })

  it('agrupa por tarjeta (con "Sin tarjeta" para tarjetaId null) desc por total', () => {
    const r = computeReportes(
      [
        gasto({ tarjetaId: 1, tarjeta: { id: 1, nombre: 'Visa' }, totalMoneda: 100 }),
        gasto({ tarjetaId: 1, tarjeta: { id: 1, nombre: 'Visa' }, totalMoneda: 200 }),
        gasto({ tarjetaId: null, tarjeta: null, totalMoneda: 500 }),
      ],
      months,
    )
    expect(r.por_tarjeta).toEqual([
      { id: null, nombre: 'Sin tarjeta', total_ars: 500 },
      { id: 1, nombre: 'Visa', total_ars: 300 },
    ])
  })

  it('agrupa por tipo de pago con nombres legibles', () => {
    const r = computeReportes(
      [
        gasto({ tipoPago: 'C', totalMoneda: 300 }),
        gasto({ tipoPago: 'D', totalMoneda: 100 }),
        gasto({ tipoPago: 'C', totalMoneda: 50 }),
      ],
      months,
    )
    expect(r.por_tipo_pago).toEqual([
      { tipo: 'C', nombre: 'Crédito', total_ars: 350 },
      { tipo: 'D', nombre: 'Débito', total_ars: 100 },
    ])
  })

  it('gasto no confirmado con sub-items usa la suma de items incluidos en total', () => {
    const r = computeReportes(
      [gasto({
        confirmado: false,
        totalMoneda: 9999,
        items: [
          { monto: 100, incluyeEnTotal: true },
          { monto: 50, incluyeEnTotal: true },
          { monto: 999, incluyeEnTotal: false },
        ],
      })],
      months,
    )
    expect(r.kpis.total).toBe(150)
  })
})
