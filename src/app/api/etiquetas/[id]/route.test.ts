import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    etiqueta: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

import { DELETE } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

beforeEach(() => { vi.clearAllMocks() })

describe('DELETE /api/etiquetas/[id]', () => {
  it('borra cuando no está en uso', async () => {
    mp.etiqueta.findUnique.mockResolvedValue({ id: 3, _count: { gastos: 0, items: 0 } })
    mp.etiqueta.delete.mockResolvedValue({ id: 3 })
    const res = await DELETE({} as any, { params: { id: '3' } })
    expect(res.status).toBe(200)
    expect(mp.etiqueta.delete).toHaveBeenCalledWith({ where: { id: 3 } })
  })

  it('devuelve 409 si está en uso', async () => {
    mp.etiqueta.findUnique.mockResolvedValue({ id: 3, _count: { gastos: 0, items: 4 } })
    const res = await DELETE({} as any, { params: { id: '3' } })
    expect(res.status).toBe(409)
    expect(mp.etiqueta.delete).not.toHaveBeenCalled()
  })

  it('devuelve 404 si no existe', async () => {
    mp.etiqueta.findUnique.mockResolvedValue(null)
    const res = await DELETE({} as any, { params: { id: '99' } })
    expect(res.status).toBe(404)
  })
})
