import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    concepto: { findUnique: vi.fn(), delete: vi.fn() },
    gasto: { updateMany: vi.fn() },
    gastoItem: { updateMany: vi.fn() },
    promocion: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

beforeEach(() => {
  vi.clearAllMocks()
  // $transaction recibe un array de promesas y devuelve sus resultados.
  mp.$transaction.mockImplementation(async (ops: any[]) => Promise.all(ops))
  mp.promocion.findMany.mockResolvedValue([])
})

describe('POST /api/conceptos/merge', () => {
  it('reasigna gastos e items del origen al destino y borra el origen', async () => {
    mp.concepto.findUnique.mockResolvedValue({ id: 2, nombre: 'Netflix' })
    mp.gasto.updateMany.mockResolvedValue({ count: 3 })
    mp.gastoItem.updateMany.mockResolvedValue({ count: 5 })
    mp.concepto.delete.mockResolvedValue({ id: 1 })

    const res = await POST({ json: async () => ({ source_id: 1, target_id: 2 }) } as any)
    const body = await res.json()

    expect(mp.gasto.updateMany).toHaveBeenCalledWith({ where: { conceptoId: 1 }, data: { conceptoId: 2 } })
    expect(mp.gastoItem.updateMany).toHaveBeenCalledWith({ where: { conceptoId: 1 }, data: { conceptoId: 2 } })
    expect(mp.concepto.delete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(body).toMatchObject({ ok: true, target_id: 2, moved_gastos: 3, moved_items: 5 })
  })

  it('conecta el destino a las promos vinculadas al origen (si no, al borrarlo perderían el vínculo)', async () => {
    mp.concepto.findUnique.mockResolvedValue({ id: 2, nombre: 'Netflix' })
    mp.gasto.updateMany.mockResolvedValue({ count: 0 })
    mp.gastoItem.updateMany.mockResolvedValue({ count: 0 })
    mp.concepto.delete.mockResolvedValue({ id: 1 })
    mp.promocion.findMany.mockResolvedValue([{ id: 7 }, { id: 8 }])

    await POST({ json: async () => ({ source_id: 1, target_id: 2 }) } as any)

    expect(mp.promocion.findMany).toHaveBeenCalledWith({
      where: { conceptos: { some: { id: 1 } } },
      select: { id: true },
    })
    expect(mp.promocion.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { conceptos: { connect: { id: 2 } } } })
    expect(mp.promocion.update).toHaveBeenCalledWith({ where: { id: 8 }, data: { conceptos: { connect: { id: 2 } } } })
  })

  it('devuelve 400 si origen y destino son iguales', async () => {
    const res = await POST({ json: async () => ({ source_id: 5, target_id: 5 }) } as any)
    expect(res.status).toBe(400)
    expect(mp.$transaction).not.toHaveBeenCalled()
  })

  it('devuelve 404 si el destino no existe', async () => {
    mp.concepto.findUnique.mockResolvedValue(null)
    const res = await POST({ json: async () => ({ source_id: 1, target_id: 2 }) } as any)
    expect(res.status).toBe(404)
  })
})
