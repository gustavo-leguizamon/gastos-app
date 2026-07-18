import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    gasto: { update: vi.fn((args: any) => args) },
    gastoItem: {
      update: vi.fn((args: any) => args),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (ops: any[]) => ops),
  },
}))

import { PATCH } from './route'
import { prisma } from '@/lib/db'

const mockPrisma = prisma as unknown as {
  gasto: { update: ReturnType<typeof vi.fn> }
  gastoItem: { update: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.gastoItem.findMany.mockResolvedValue([])
})

describe('PATCH /api/gastos/etiquetas', () => {
  it('conecta (add) una etiqueta a varios gastos en una transacción', async () => {
    const body = { gasto_ids: [1, 2], etiqueta_id: 7, action: 'add' }
    const res = await PATCH({ json: async () => body } as any)

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(mockPrisma.gasto.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { etiquetas: { connect: { id: 7 } } },
    })
    expect(mockPrisma.gasto.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { etiquetas: { connect: { id: 7 } } },
    })
    expect(await res.json()).toEqual({ ok: true, updated: 2 })
  })

  it('desconecta (remove) una etiqueta y la propaga a los sub-items de tarjeta', async () => {
    mockPrisma.gastoItem.findMany.mockResolvedValue([{ id: 50 }, { id: 51 }])
    const body = { gasto_ids: [3], etiqueta_id: 4, action: 'remove' }
    await PATCH({ json: async () => body } as any)

    expect(mockPrisma.gastoItem.findMany).toHaveBeenCalledWith({
      where: { pago: { gastoId: { in: [3] } } },
      select: { id: true },
    })
    expect(mockPrisma.gasto.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { etiquetas: { disconnect: { id: 4 } } },
    })
    expect(mockPrisma.gastoItem.update).toHaveBeenCalledWith({
      where: { id: 50 },
      data: { etiquetas: { disconnect: { id: 4 } } },
    })
    expect(mockPrisma.gastoItem.update).toHaveBeenCalledWith({
      where: { id: 51 },
      data: { etiquetas: { disconnect: { id: 4 } } },
    })
  })

  it('responde 400 con body inválido sin tocar la DB', async () => {
    const res = await PATCH({ json: async () => ({ gasto_ids: [1], etiqueta_id: 0, action: 'add' }) } as any)
    expect(res.status).toBe(400)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })
})
