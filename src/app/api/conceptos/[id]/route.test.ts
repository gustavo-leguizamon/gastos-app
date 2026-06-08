import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    concepto: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

import { PATCH, DELETE } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

beforeEach(() => { vi.clearAllMocks() })

describe('PATCH /api/conceptos/[id]', () => {
  it('renombra (normalizado) cuando no hay colisión', async () => {
    mp.concepto.findFirst.mockResolvedValue(null)
    mp.concepto.update.mockResolvedValue({ id: 3, nombre: 'Netflix' })
    const res = await PATCH({ json: async () => ({ nombre: '  Netflix ' }) } as any, { params: { id: '3' } })
    expect(res.status).toBe(200)
    expect(mp.concepto.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { nombre: 'Netflix' } })
  })

  it('devuelve 409 si ya existe otro concepto con ese nombre', async () => {
    mp.concepto.findFirst.mockResolvedValue({ id: 8, nombre: 'Netflix' })
    const res = await PATCH({ json: async () => ({ nombre: 'netflix' }) } as any, { params: { id: '3' } })
    expect(res.status).toBe(409)
    expect(mp.concepto.update).not.toHaveBeenCalled()
  })

  it('devuelve 400 si el nombre queda vacío', async () => {
    const res = await PATCH({ json: async () => ({ nombre: '   ' }) } as any, { params: { id: '3' } })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/conceptos/[id]', () => {
  it('borra cuando no está en uso', async () => {
    mp.concepto.findUnique.mockResolvedValue({ id: 3, _count: { gastos: 0, items: 0 } })
    mp.concepto.delete.mockResolvedValue({ id: 3 })
    const res = await DELETE({} as any, { params: { id: '3' } })
    expect(res.status).toBe(200)
    expect(mp.concepto.delete).toHaveBeenCalledWith({ where: { id: 3 } })
  })

  it('devuelve 409 si está en uso', async () => {
    mp.concepto.findUnique.mockResolvedValue({ id: 3, _count: { gastos: 2, items: 1 } })
    const res = await DELETE({} as any, { params: { id: '3' } })
    expect(res.status).toBe(409)
    expect(mp.concepto.delete).not.toHaveBeenCalled()
  })

  it('devuelve 404 si no existe', async () => {
    mp.concepto.findUnique.mockResolvedValue(null)
    const res = await DELETE({} as any, { params: { id: '99' } })
    expect(res.status).toBe(404)
  })
})
