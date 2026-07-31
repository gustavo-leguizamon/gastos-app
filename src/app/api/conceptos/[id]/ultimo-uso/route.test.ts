import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    gasto: { findFirst: vi.fn() },
  },
}))

import { GET } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/conceptos/[id]/ultimo-uso', () => {
  it('excluye resúmenes de tarjeta y ordena por el último uso', async () => {
    mp.gasto.findFirst.mockResolvedValue(null)
    await GET({} as any, { params: { id: '4' } })

    const arg = mp.gasto.findFirst.mock.calls[0][0]
    expect(arg.where).toEqual({ conceptoId: 4, esTarjeta: false })
    expect(arg.orderBy).toEqual([{ anio: 'desc' }, { mes: 'desc' }, { id: 'desc' }])
  })

  it('devuelve los defaults mapeados a snake_case', async () => {
    mp.gasto.findFirst.mockResolvedValue({
      casaId: 1,
      tipoPago: 'C',
      monedaId: 3,
      tipoCambio: 1,
      tarjetaId: 9,
      categoriaId: 2,
      totalMoneda: 5900,
      mes: 6,
      anio: 2026,
      etiquetas: [{ id: 8 }],
    })

    const res = await GET({} as any, { params: { id: '4' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      casa_id: 1,
      tipo_pago: 'C',
      moneda_id: 3,
      tipo_cambio: 1,
      tarjeta_id: 9,
      categoria_id: 2,
      etiqueta_ids: [8],
      total_moneda: 5900,
      origen: { mes: 6, anio: 2026 },
    })
  })

  it('devuelve null cuando el concepto no tiene gastos previos', async () => {
    mp.gasto.findFirst.mockResolvedValue(null)
    const res = await GET({} as any, { params: { id: '4' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('devuelve 400 con un id inválido y no consulta la DB', async () => {
    const res = await GET({} as any, { params: { id: 'abc' } })
    expect(res.status).toBe(400)
    expect(mp.gasto.findFirst).not.toHaveBeenCalled()
  })
})
