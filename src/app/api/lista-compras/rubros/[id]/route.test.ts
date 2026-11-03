import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: { rubro: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() } },
}))

import { PUT, DELETE } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any
const req = (body: any) => ({ json: async () => body }) as any
const ctx = (id: string) => ({ params: { id } })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PUT /api/lista-compras/rubros/[id]', () => {
  it('400 con id o nombre inválido, sin tocar la DB', async () => {
    expect((await PUT(req({ nombre: 'Almacén' }), ctx('x'))).status).toBe(400)
    expect((await PUT(req({ nombre: '  ' }), ctx('1'))).status).toBe(400)
    expect(mp.rubro.findUnique).not.toHaveBeenCalled()
  })

  it('renombra y devuelve la fila', async () => {
    mp.rubro.findUnique.mockResolvedValue({ id: 1, nombre: 'Limpieza' })
    mp.rubro.findFirst.mockResolvedValue(null)
    mp.rubro.update.mockResolvedValue({ id: 1, nombre: 'Almacén' })
    const res = await PUT(req({ nombre: 'Almacén' }), ctx('1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 1, nombre: 'Almacén' })
  })

  it('409 si el nombre ya lo tiene otra rubro', async () => {
    mp.rubro.findUnique.mockResolvedValue({ id: 1, nombre: 'Limpieza' })
    mp.rubro.findFirst.mockResolvedValue({ id: 2, nombre: 'Almacén' })
    expect((await PUT(req({ nombre: 'Almacén' }), ctx('1'))).status).toBe(409)
  })
})

describe('DELETE /api/lista-compras/rubros/[id]', () => {
  it('400 con id inválido', async () => {
    expect((await DELETE({} as any, ctx('0'))).status).toBe(400)
  })

  it('409 si está en uso y no borra', async () => {
    mp.rubro.findUnique.mockResolvedValue({ id: 1, _count: { articulos: 2 } })
    const res = await DELETE({} as any, ctx('1'))
    expect(res.status).toBe(409)
    expect((await res.json()).uso).toBe(2)
    expect(mp.rubro.delete).not.toHaveBeenCalled()
  })

  it('borra si nadie la usa', async () => {
    mp.rubro.findUnique.mockResolvedValue({ id: 1, _count: { articulos: 0 } })
    expect((await DELETE({} as any, ctx('1'))).status).toBe(200)
    expect(mp.rubro.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
