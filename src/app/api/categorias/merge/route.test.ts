import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    categoria: { findUnique: vi.fn(), delete: vi.fn() },
    gasto: { updateMany: vi.fn() },
    gastoItem: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const req = (body: any) => ({ json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
  mp.$transaction.mockResolvedValue([{ count: 4 }, { count: 2 }, {}])
})

describe('POST /api/categorias/merge', () => {
  it('reapunta gastos y sub-items al destino y borra el origen', async () => {
    mp.categoria.findUnique
      .mockResolvedValueOnce({ id: 1, nombre: 'comida' })
      .mockResolvedValueOnce({ id: 2, nombre: 'Comida' })

    const res = await POST(req({ source_id: 1, target_id: 2 }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, target_id: 2, moved_gastos: 4, moved_items: 2 })
    expect(mp.gasto.updateMany).toHaveBeenCalledWith({ where: { categoriaId: 1 }, data: { categoriaId: 2 } })
    expect(mp.gastoItem.updateMany).toHaveBeenCalledWith({ where: { categoriaId: 1 }, data: { categoriaId: 2 } })
    expect(mp.categoria.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  it('las tres operaciones van en una sola transacción', async () => {
    mp.categoria.findUnique.mockResolvedValue({ id: 1 })
    await POST(req({ source_id: 1, target_id: 2 }))
    expect(mp.$transaction).toHaveBeenCalledTimes(1)
    expect(mp.$transaction.mock.calls[0][0]).toHaveLength(3)
  })

  it('devuelve 400 con body inválido, sin tocar la DB', async () => {
    for (const body of [{}, { source_id: 1 }, { source_id: 5, target_id: 5 }, { source_id: 0, target_id: 2 }]) {
      const res = await POST(req(body))
      expect(res.status).toBe(400)
    }
    expect(mp.$transaction).not.toHaveBeenCalled()
  })

  it('devuelve 404 si falta el origen o el destino', async () => {
    mp.categoria.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 2 })
    expect((await POST(req({ source_id: 1, target_id: 2 }))).status).toBe(404)

    mp.categoria.findUnique.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce(null)
    expect((await POST(req({ source_id: 1, target_id: 2 }))).status).toBe(404)

    expect(mp.$transaction).not.toHaveBeenCalled()
  })
})
