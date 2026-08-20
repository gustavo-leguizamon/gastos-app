import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    etiqueta: { findUnique: vi.fn(), delete: vi.fn() },
    gasto: { update: vi.fn() },
    gastoItem: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const req = (body: any) => ({ json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
  mp.$transaction.mockResolvedValue([])
})

describe('POST /api/etiquetas/merge', () => {
  it('conecta el destino en cada gasto y sub-item del origen, y borra el origen', async () => {
    mp.etiqueta.findUnique
      .mockResolvedValueOnce({ id: 1, gastos: [{ id: 10 }, { id: 11 }], items: [{ id: 20 }] })
      .mockResolvedValueOnce({ id: 2, nombre: 'Viaje' })

    const res = await POST(req({ source_id: 1, target_id: 2 }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, target_id: 2, moved_gastos: 2, moved_items: 1 })
    expect(mp.gasto.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { etiquetas: { connect: { id: 2 } } } })
    expect(mp.gasto.update).toHaveBeenCalledWith({ where: { id: 11 }, data: { etiquetas: { connect: { id: 2 } } } })
    expect(mp.gastoItem.update).toHaveBeenCalledWith({ where: { id: 20 }, data: { etiquetas: { connect: { id: 2 } } } })
    expect(mp.etiqueta.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  it('todo va en una sola transacción: N gastos + M items + el delete', async () => {
    mp.etiqueta.findUnique
      .mockResolvedValueOnce({ id: 1, gastos: [{ id: 10 }, { id: 11 }], items: [{ id: 20 }] })
      .mockResolvedValueOnce({ id: 2 })
    await POST(req({ source_id: 1, target_id: 2 }))
    expect(mp.$transaction.mock.calls[0][0]).toHaveLength(4)
  })

  it('una etiqueta sin uso sólo se borra', async () => {
    mp.etiqueta.findUnique
      .mockResolvedValueOnce({ id: 1, gastos: [], items: [] })
      .mockResolvedValueOnce({ id: 2 })
    const res = await POST(req({ source_id: 1, target_id: 2 }))
    expect(await res.json()).toMatchObject({ moved_gastos: 0, moved_items: 0 })
    expect(mp.$transaction.mock.calls[0][0]).toHaveLength(1)
  })

  it('devuelve 400 con body inválido, sin tocar la DB', async () => {
    for (const body of [{}, { target_id: 2 }, { source_id: 5, target_id: 5 }]) {
      expect((await POST(req(body))).status).toBe(400)
    }
    expect(mp.$transaction).not.toHaveBeenCalled()
  })

  it('devuelve 404 si falta el origen o el destino', async () => {
    mp.etiqueta.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 2 })
    expect((await POST(req({ source_id: 1, target_id: 2 }))).status).toBe(404)

    mp.etiqueta.findUnique.mockResolvedValueOnce({ id: 1, gastos: [], items: [] }).mockResolvedValueOnce(null)
    expect((await POST(req({ source_id: 1, target_id: 2 }))).status).toBe(404)

    expect(mp.$transaction).not.toHaveBeenCalled()
  })
})
