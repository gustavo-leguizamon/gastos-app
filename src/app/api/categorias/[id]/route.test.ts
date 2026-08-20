import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    categoria: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

import { DELETE, PUT } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const reqCon = (body: any) => ({ json: async () => body }) as any

beforeEach(() => { vi.clearAllMocks() })

describe('PUT /api/categorias/[id]', () => {
  it('renombra normalizando el nombre', async () => {
    mp.categoria.findFirst.mockResolvedValue(null)
    mp.categoria.update.mockResolvedValue({ id: 3, nombre: 'Comida afuera' })
    const res = await PUT(reqCon({ nombre: '  Comida   afuera  ' }), { params: { id: '3' } })
    expect(res.status).toBe(200)
    expect(mp.categoria.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { nombre: 'Comida afuera' } })
  })

  it('devuelve 409 si otra categoría ya usa ese nombre', async () => {
    mp.categoria.findFirst.mockResolvedValue({ id: 9, nombre: 'Comida' })
    const res = await PUT(reqCon({ nombre: 'comida' }), { params: { id: '3' } })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: expect.stringContaining('Fusionalas') })
    expect(mp.categoria.update).not.toHaveBeenCalled()
  })

  it('la colisión se busca case-insensitive y excluye a la propia fila', async () => {
    mp.categoria.findFirst.mockResolvedValue(null)
    mp.categoria.update.mockResolvedValue({ id: 3, nombre: 'Comida' })
    await PUT(reqCon({ nombre: 'Comida' }), { params: { id: '3' } })
    expect(mp.categoria.findFirst).toHaveBeenCalledWith({
      where: { nombre: { equals: 'Comida', mode: 'insensitive' }, id: { not: 3 } },
    })
  })

  it('devuelve 400 con nombre vacío, sin tocar la DB', async () => {
    const res = await PUT(reqCon({ nombre: '   ' }), { params: { id: '3' } })
    expect(res.status).toBe(400)
    expect(mp.categoria.findFirst).not.toHaveBeenCalled()
    expect(mp.categoria.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/categorias/[id]', () => {
  it('borra cuando no está en uso', async () => {
    mp.categoria.findUnique.mockResolvedValue({ id: 3, _count: { gastos: 0, items: 0 } })
    mp.categoria.delete.mockResolvedValue({ id: 3 })
    const res = await DELETE({} as any, { params: { id: '3' } })
    expect(res.status).toBe(200)
    expect(mp.categoria.delete).toHaveBeenCalledWith({ where: { id: 3 } })
  })

  it('devuelve 409 si está en uso', async () => {
    mp.categoria.findUnique.mockResolvedValue({ id: 3, _count: { gastos: 2, items: 1 } })
    const res = await DELETE({} as any, { params: { id: '3' } })
    expect(res.status).toBe(409)
    expect(mp.categoria.delete).not.toHaveBeenCalled()
  })

  it('devuelve 404 si no existe', async () => {
    mp.categoria.findUnique.mockResolvedValue(null)
    const res = await DELETE({} as any, { params: { id: '99' } })
    expect(res.status).toBe(404)
  })
})
