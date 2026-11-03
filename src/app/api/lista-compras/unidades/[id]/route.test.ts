import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: { unidad: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() } },
}))

import { PUT, DELETE } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any
const req = (body: any) => ({ json: async () => body }) as any
const ctx = (id: string) => ({ params: { id } })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PUT /api/lista-compras/unidades/[id]', () => {
  it('400 con id, nombre o equivalencia inválidos, sin tocar la DB', async () => {
    expect((await PUT(req({ nombre: 'kg' }), ctx('x'))).status).toBe(400)
    expect((await PUT(req({ nombre: '  ' }), ctx('1'))).status).toBe(400)
    expect((await PUT(req({ subunidad_de: 'g' }), ctx('1'))).status).toBe(400)
    expect((await PUT(req({}), ctx('1'))).status).toBe(400)
    expect(mp.unidad.findUnique).not.toHaveBeenCalled()
  })

  it('renombra y devuelve la fila', async () => {
    mp.unidad.findUnique.mockResolvedValue({ id: 1, nombre: 'kilo' })
    mp.unidad.findFirst.mockResolvedValue(null)
    mp.unidad.update.mockResolvedValue({ id: 1, nombre: 'kg' })
    const res = await PUT(req({ nombre: 'kg' }), ctx('1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 1, nombre: 'kg', subunidad_de: null })
  })

  it('fija la equivalencia (g → kg)', async () => {
    mp.unidad.findUnique.mockResolvedValue({ id: 1, nombre: 'g', subunidadDe: null })
    mp.unidad.update.mockResolvedValue({ id: 1, nombre: 'g', subunidadDe: 'kg' })
    const res = await PUT(req({ subunidad_de: 'kg' }), ctx('1'))
    expect(mp.unidad.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { subunidadDe: 'kg' } })
    expect(await res.json()).toEqual({ id: 1, nombre: 'g', subunidad_de: 'kg' })
  })

  it('409 si el nombre ya lo tiene otra unidad', async () => {
    mp.unidad.findUnique.mockResolvedValue({ id: 1, nombre: 'kilo' })
    mp.unidad.findFirst.mockResolvedValue({ id: 2, nombre: 'kg' })
    expect((await PUT(req({ nombre: 'kg' }), ctx('1'))).status).toBe(409)
  })
})

describe('DELETE /api/lista-compras/unidades/[id]', () => {
  it('400 con id inválido', async () => {
    expect((await DELETE({} as any, ctx('0'))).status).toBe(400)
  })

  it('409 si está en uso y no borra', async () => {
    mp.unidad.findUnique.mockResolvedValue({ id: 1, _count: { articulos: 2 } })
    const res = await DELETE({} as any, ctx('1'))
    expect(res.status).toBe(409)
    expect((await res.json()).uso).toBe(2)
    expect(mp.unidad.delete).not.toHaveBeenCalled()
  })

  it('borra si nadie la usa', async () => {
    mp.unidad.findUnique.mockResolvedValue({ id: 1, _count: { articulos: 0 } })
    expect((await DELETE({} as any, ctx('1'))).status).toBe(200)
    expect(mp.unidad.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
