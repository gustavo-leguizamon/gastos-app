import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: { gasto: { findMany: vi.fn() } },
}))

import { GET } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const req = (qs: string) => ({ url: `http://localhost:3002/api/tarjetas/cuotas-proyeccion?${qs}` }) as any

const item = (concepto: string, monto: number, cuotaActual: number, cuotasTotales: number, conceptoId = 1) => ({
  conceptoId, monto, cuotaActual, cuotasTotales, concepto: { nombre: concepto },
})

const resumen = (id: number, mes: number, anio: number, items: any[], tarjetaId = 10, casaId = 1) => ({
  id, tarjetaId, casaId, mes, anio, tarjeta: { nombre: 'Visa', banco: 'Galicia' }, items,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/tarjetas/cuotas-proyeccion', () => {
  it('400 con período inválido sin tocar la DB', async () => {
    const res = await GET(req('mes=13&anio=2026'))
    expect(res.status).toBe(400)
    expect(mp.gasto.findMany).not.toHaveBeenCalled()
  })

  it('busca resúmenes desde 12 meses atrás, con casa y sólo sub-items con cuotas', async () => {
    mp.gasto.findMany.mockResolvedValue([])
    await GET(req('mes=3&anio=2027&casa_id=2'))
    const where = mp.gasto.findMany.mock.calls[0][0].where
    expect(where).toEqual({
      esTarjeta: true,
      casaId: 2,
      OR: [{ anio: { gt: 2026 } }, { anio: 2026, mes: { gte: 3 } }],
    })
    const itemsWhere = mp.gasto.findMany.mock.calls[0][0].select.items.where
    expect(itemsWhere).toEqual({ cuotaActual: { not: null }, cuotasTotales: { not: null }, incluyeEnTotal: true })
  })

  it('sin casa no filtra por casa', async () => {
    mp.gasto.findMany.mockResolvedValue([])
    await GET(req('mes=11&anio=2026'))
    expect(mp.gasto.findMany.mock.calls[0][0].where.casaId).toBeUndefined()
  })

  it('proyecta desde la base y los posteriores, ignorando resúmenes anteriores a la base', async () => {
    mp.gasto.findMany.mockResolvedValue([
      // anterior a la base: una cuota que en noviembre se borró no tiene que volver
      resumen(1, 10, 2026, [item('Borrada', 999, 1, 6, 9), item('Tele', 500, 1, 3)]),
      resumen(2, 11, 2026, [item('Tele', 500, 2, 3)]),
      resumen(3, 12, 2026, [item('Tele', 500, 3, 3)]),
    ])
    const res = await GET(req('mes=11&anio=2026'))
    const body = await res.json()
    expect(body.compras).toHaveLength(1)
    expect(body.compras[0]).toMatchObject({ concepto: 'Tele', tarjeta: 'Visa (Galicia)', pendiente: 1000 })
    expect(body.meses).toEqual([
      { mes: 11, anio: 2026, total: 500, cantidad: 1 },
      { mes: 12, anio: 2026, total: 500, cantidad: 1 },
    ])
    expect(body.total_futuro).toBe(500)
  })
})
