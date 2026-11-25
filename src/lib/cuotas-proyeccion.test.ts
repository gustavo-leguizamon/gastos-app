import { describe, it, expect } from 'vitest'
import { proyectarCuotas, seleccionarResumenes, esCuotaValida, type CuotaFuente } from './cuotas-proyeccion'

const f = (over: Partial<CuotaFuente>): CuotaFuente => ({
  gasto_id: 1,
  tarjeta_id: 10,
  tarjeta: 'Visa',
  casa_id: 1,
  concepto_id: 100,
  concepto: 'Heladera',
  monto: 1000,
  cuota_actual: 1,
  cuotas_totales: 3,
  mes: 11,
  anio: 2026,
  ...over,
})

describe('esCuotaValida', () => {
  it('rechaza datos incoherentes o una sola cuota', () => {
    expect(esCuotaValida({ cuota_actual: 1, cuotas_totales: 1 })).toBe(false)
    expect(esCuotaValida({ cuota_actual: 0, cuotas_totales: 3 })).toBe(false)
    expect(esCuotaValida({ cuota_actual: 4, cuotas_totales: 3 })).toBe(false)
    expect(esCuotaValida({ cuota_actual: 3, cuotas_totales: 3 })).toBe(true)
  })
})

describe('proyectarCuotas', () => {
  it('extiende una compra hasta la última cuota, con wraparound de año', () => {
    const r = proyectarCuotas([f({ cuota_actual: 2, cuotas_totales: 4 })], { mes: 11, anio: 2026 })
    expect(r.meses).toEqual([
      { mes: 11, anio: 2026, total: 1000, cantidad: 1 },
      { mes: 12, anio: 2026, total: 1000, cantidad: 1 },
      { mes: 1, anio: 2027, total: 1000, cantidad: 1 },
    ])
    expect(r.compras[0].cuotas.map(c => c.cuota)).toEqual([2, 3, 4])
    expect(r.compras[0].origen).toEqual({ mes: 10, anio: 2026 })
    expect(r.compras[0].ultima).toEqual({ mes: 1, anio: 2027 })
    expect(r.total_pendiente).toBe(3000)
    expect(r.total_futuro).toBe(2000)
  })

  it('no duplica la misma compra vista en dos resúmenes consecutivos', () => {
    const r = proyectarCuotas(
      [
        f({ gasto_id: 1, cuota_actual: 2, cuotas_totales: 4, mes: 11 }),
        f({ gasto_id: 2, cuota_actual: 3, cuotas_totales: 4, mes: 12 }),
      ],
      { mes: 11, anio: 2026 },
    )
    expect(r.compras).toHaveLength(1)
    expect(r.total_pendiente).toBe(3000)
  })

  it('cuenta dos compras idénticas del mismo resumen como dos', () => {
    const r = proyectarCuotas(
      [
        f({ gasto_id: 1, cuota_actual: 1 }),
        f({ gasto_id: 1, cuota_actual: 1 }),
        // la copia del mes siguiente las trae a las dos: no suma una tercera
        f({ gasto_id: 2, cuota_actual: 2, mes: 12 }),
        f({ gasto_id: 2, cuota_actual: 2, mes: 12 }),
      ],
      { mes: 11, anio: 2026 },
    )
    expect(r.compras).toHaveLength(2)
    expect(r.meses[0]).toEqual({ mes: 11, anio: 2026, total: 2000, cantidad: 2 })
  })

  it('distingue compras con distinto origen, monto, tarjeta o casa', () => {
    const r = proyectarCuotas(
      [
        f({}),
        f({ cuota_actual: 2 }), // empezó un mes antes
        f({ monto: 500 }),
        f({ tarjeta_id: 11 }),
        f({ casa_id: 2 }),
      ],
      { mes: 11, anio: 2026 },
    )
    expect(r.compras).toHaveLength(5)
  })

  it('una cuota del mes siguiente (resumen futuro) arranca después del mes consultado', () => {
    const r = proyectarCuotas([f({ mes: 12, cuota_actual: 1, cuotas_totales: 2 })], { mes: 11, anio: 2026 })
    expect(r.meses).toEqual([
      { mes: 11, anio: 2026, total: 0, cantidad: 0 },
      { mes: 12, anio: 2026, total: 1000, cantidad: 1 },
      { mes: 1, anio: 2027, total: 1000, cantidad: 1 },
    ])
    expect(r.total_futuro).toBe(2000)
  })

  it('una base vieja proyecta sólo desde el mes consultado', () => {
    const r = proyectarCuotas([f({ mes: 9, cuota_actual: 1, cuotas_totales: 4 })], { mes: 11, anio: 2026 })
    expect(r.compras[0].cuotas.map(c => c.cuota)).toEqual([3, 4])
  })

  it('descarta compras ya terminadas e inválidas', () => {
    const r = proyectarCuotas(
      [f({ mes: 9, cuota_actual: 1, cuotas_totales: 2 }), f({ cuota_actual: 1, cuotas_totales: 1 })],
      { mes: 11, anio: 2026 },
    )
    expect(r.compras).toEqual([])
    expect(r.meses).toEqual([])
    expect(r.total_pendiente).toBe(0)
  })

  it('ordena por fecha de fin', () => {
    const r = proyectarCuotas(
      [f({ concepto_id: 1, concepto: 'Larga', cuotas_totales: 12 }), f({ concepto_id: 2, concepto: 'Corta', cuotas_totales: 2 })],
      { mes: 11, anio: 2026 },
    )
    expect(r.compras.map(c => c.concepto)).toEqual(['Corta', 'Larga'])
  })
})

describe('seleccionarResumenes', () => {
  const r = (id: number, mes: number, anio: number, tarjeta_id = 10, casa_id = 1) => ({ id, mes, anio, tarjeta_id, casa_id })

  it('toma el último ≤ al mes por tarjeta y casa, más los posteriores', () => {
    const sel = seleccionarResumenes(
      [r(1, 9, 2026), r(2, 10, 2026), r(3, 12, 2026), r(4, 8, 2026, 11), r(5, 10, 2026, 10, 2)],
      { mes: 11, anio: 2026 },
    )
    expect(sel.map(x => x.id).sort()).toEqual([2, 3, 4, 5])
  })

  it('con resumen del mes, los anteriores no entran', () => {
    const sel = seleccionarResumenes([r(1, 10, 2026), r(2, 11, 2026)], { mes: 11, anio: 2026 })
    expect(sel.map(x => x.id)).toEqual([2])
  })
})
