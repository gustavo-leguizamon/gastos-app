import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    gasto: { update: vi.fn((args: any) => args) },
    $transaction: vi.fn(async (ops: any[]) => ops),
  },
}))

import { PATCH } from './route'
import { prisma } from '@/lib/db'

const mockPrisma = prisma as unknown as {
  gasto: { update: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
}

beforeEach(() => { vi.clearAllMocks() })

describe('PATCH /api/gastos/categorias', () => {
  it('agrega (connect) una categoría a varios gastos en una transacción', async () => {
    const body = { gasto_ids: [1, 2], categoria_id: 7, action: 'add' }
    const res = await PATCH({ json: async () => body } as any)

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(mockPrisma.gasto.update).toHaveBeenCalledTimes(2)
    expect(mockPrisma.gasto.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { categorias: { connect: { id: 7 } } },
    })
    expect(mockPrisma.gasto.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { categorias: { connect: { id: 7 } } },
    })
    expect(await res.json()).toEqual({ ok: true, updated: 2 })
  })

  it('quita (disconnect) una categoría', async () => {
    const body = { gasto_ids: [3], categoria_id: 4, action: 'remove' }
    await PATCH({ json: async () => body } as any)
    expect(mockPrisma.gasto.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { categorias: { disconnect: { id: 4 } } },
    })
  })

  it('responde 400 con body inválido sin tocar la DB', async () => {
    const res = await PATCH({ json: async () => ({ gasto_ids: [], categoria_id: 1, action: 'add' }) } as any)
    expect(res.status).toBe(400)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })
})
