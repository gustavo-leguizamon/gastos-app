import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    promocionReintegro: { findMany: vi.fn() },
    promocion: { findMany: vi.fn() },
    gasto: { findMany: vi.fn() },
  },
}))

import { GET } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

/** 20% hasta $10.000. */
const promo = (id: number, lugar: string) => ({
  id, lugar, porcentaje: 20, topeMensual: 10000, dias: [1], efectivo: false, activa: true, notas: null,
  vigenteDesde: null, vigenteHasta: null, conceptos: [], tarjetas: [], usos: [],
})
const fila = (promocionId: number, mes: number, anio: number, venceEl: string) => ({
  promocionId, mes, anio, venceEl, utilizado: false,
})

beforeEach(() => {
  vi.clearAllMocks()
  mp.promocionReintegro.findMany.mockResolvedValue([])
  mp.promocion.findMany.mockResolvedValue([])
  mp.gasto.findMany.mockResolvedValue([])
})

describe('GET /api/promociones/vencimientos', () => {
  it('pide sólo los pendientes (no utilizados) con fecha de vencimiento, de cualquier mes', async () => {
    await GET()
    expect(mp.promocionReintegro.findMany.mock.calls[0][0].where).toEqual({
      utilizado: false, venceEl: { not: null },
    })
  })

  it('[] si no hay nada cargado, sin consultar promos ni gastos', async () => {
    expect(await (await GET()).json()).toEqual([])
    expect(mp.promocion.findMany).not.toHaveBeenCalled()
    expect(mp.gasto.findMany).not.toHaveBeenCalled()
  })

  it('calcula el monto con los gastos del mes de ORIGEN y ordena por vencimiento', async () => {
    mp.promocionReintegro.findMany.mockResolvedValue([
      fila(1, 10, 2026, '2026-12-20'),
      fila(2, 11, 2026, '2026-12-05'),
    ])
    mp.promocion.findMany.mockImplementation(async ({ where }: any) =>
      where.id.in.map((id: number) => promo(id, id === 1 ? 'Carrefour' : 'Coto')))
    mp.gasto.findMany.mockImplementation(async ({ where }: any) =>
      where.mes === 10 ? [{ promocionId: 1, totalMoneda: 30000, tipoCambio: 1 }] : [{ promocionId: 2, totalMoneda: 100000, tipoCambio: 1 }])

    const r = await (await GET()).json()

    // El de noviembre vence antes; está topeado en $10.000. El de octubre: 20% de 30.000.
    expect(r).toEqual([
      { promocion_id: 2, lugar: 'Coto', mes: 11, anio: 2026, vence_el: '2026-12-05', utilizado: false, reintegrado: 10000 },
      { promocion_id: 1, lugar: 'Carrefour', mes: 10, anio: 2026, vence_el: '2026-12-20', utilizado: false, reintegrado: 6000 },
    ])
    expect(mp.promocion.findMany.mock.calls.map((c: any) => c[0].include.usos.where)).toEqual([
      { mes: 10, anio: 2026 }, { mes: 11, anio: 2026 },
    ])
  })

  it('no lista los de monto 0: no hay nada que perder', async () => {
    mp.promocionReintegro.findMany.mockResolvedValue([fila(1, 10, 2026, '2026-12-20')])
    mp.promocion.findMany.mockResolvedValue([promo(1, 'Carrefour')])
    mp.gasto.findMany.mockResolvedValue([])
    expect(await (await GET()).json()).toEqual([])
  })
})
