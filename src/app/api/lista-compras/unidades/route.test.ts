import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: { unidad: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() } },
}))

import { GET, POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any
const post = (body: any) => ({ json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/api/lista-compras/unidades', () => {
  it('GET lista por nombre, con la cantidad de artículos que la usan', async () => {
    mp.unidad.findMany.mockResolvedValue([{ id: 1, nombre: 'kg', subunidadDe: null, _count: { articulos: 4 } }])
    const res = await GET()
    expect(mp.unidad.findMany.mock.calls[0][0].orderBy).toEqual({ nombre: 'asc' })
    expect(await res.json()).toEqual([{ id: 1, nombre: 'kg', subunidad_de: null, uso: 4 }])
  })

  it('POST 400 con nombre vacío, sin tocar la DB', async () => {
    expect((await POST(post({ nombre: '  ' }))).status).toBe(400)
    expect(mp.unidad.findFirst).not.toHaveBeenCalled()
  })

  it('POST crea una unidad nueva (201)', async () => {
    mp.unidad.findFirst.mockResolvedValue(null)
    mp.unidad.create.mockResolvedValue({ id: 8, nombre: 'docena' })
    const res = await POST(post({ nombre: ' docena ' }))
    expect(res.status).toBe(201)
    expect(mp.unidad.create).toHaveBeenCalledWith({ data: { nombre: 'docena' } })
    expect(await res.json()).toEqual({ id: 8, nombre: 'docena', subunidad_de: null })
  })

  it('POST infiere la equivalencia por el nombre: gramos → kg', async () => {
    mp.unidad.findFirst.mockResolvedValue(null)
    mp.unidad.create.mockResolvedValue({ id: 9, nombre: 'gramos', subunidadDe: 'kg' })
    const res = await POST(post({ nombre: 'gramos' }))
    expect(mp.unidad.create).toHaveBeenCalledWith({ data: { nombre: 'gramos', subunidadDe: 'kg' } })
    expect(await res.json()).toMatchObject({ subunidad_de: 'kg' })
  })

  it('POST ml → l', async () => {
    mp.unidad.findFirst.mockResolvedValue(null)
    mp.unidad.create.mockResolvedValue({ id: 10, nombre: 'ml', subunidadDe: 'l' })
    await POST(post({ nombre: 'ml' }))
    expect(mp.unidad.create).toHaveBeenCalledWith({ data: { nombre: 'ml', subunidadDe: 'l' } })
  })

  it('POST con un nombre existente (sin distinguir mayúsculas) devuelve la existente con 200', async () => {
    mp.unidad.findFirst.mockResolvedValue({ id: 1, nombre: 'kg' })
    const res = await POST(post({ nombre: 'KG' }))
    expect(mp.unidad.findFirst.mock.calls[0][0].where).toEqual({ nombre: { equals: 'KG', mode: 'insensitive' } })
    expect(mp.unidad.create).not.toHaveBeenCalled()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 1, nombre: 'kg', subunidad_de: null })
  })

  it('POST ante una carrera (P2002) devuelve la que creó el otro request', async () => {
    mp.unidad.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 9, nombre: 'pack' })
    mp.unidad.create.mockRejectedValue({ code: 'P2002' })
    const res = await POST(post({ nombre: 'pack' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 9, nombre: 'pack', subunidad_de: null })
  })
})
