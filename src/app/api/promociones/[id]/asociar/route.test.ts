import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    promocion: { findUnique: vi.fn() },
    gasto: { updateMany: vi.fn() },
  },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any
const body = (b: any) => ({ json: async () => b }) as any
const params = (id: string) => ({ params: { id } })

beforeEach(() => {
  vi.clearAllMocks()
  mp.promocion.findUnique.mockResolvedValue({ id: 1 })
  mp.gasto.updateMany.mockResolvedValue({ count: 2 })
})

describe('POST /api/promociones/[id]/asociar', () => {
  it('400 con id, ids o flag inválido, sin tocar la DB', async () => {
    expect((await POST(body({ gasto_ids: [1], asociar: true }), params('x'))).status).toBe(400)
    expect((await POST(body({ gasto_ids: [], asociar: true }), params('1'))).status).toBe(400)
    expect((await POST(body({ gasto_ids: [1] }), params('1'))).status).toBe(400)
    expect(mp.gasto.updateMany).not.toHaveBeenCalled()
  })

  it('404 si la promo no existe', async () => {
    mp.promocion.findUnique.mockResolvedValue(null)
    expect((await POST(body({ gasto_ids: [1], asociar: true }), params('1'))).status).toBe(404)
    expect(mp.gasto.updateMany).not.toHaveBeenCalled()
  })

  it('asociar: pisa la asociación anterior de esos gastos (dedup de ids)', async () => {
    const res = await POST(body({ gasto_ids: [3, 4, 3], asociar: true }), params('1'))
    expect(await res.json()).toEqual({ ok: true, actualizados: 2 })
    expect(mp.gasto.updateMany).toHaveBeenCalledWith({ where: { id: { in: [3, 4] } }, data: { promocionId: 1 } })
  })

  it('desasociar: sólo suelta los que son de ESTA promo', async () => {
    await POST(body({ gasto_ids: [3], asociar: false }), params('1'))
    expect(mp.gasto.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [3] }, promocionId: 1 },
      data: { promocionId: null },
    })
  })
})
