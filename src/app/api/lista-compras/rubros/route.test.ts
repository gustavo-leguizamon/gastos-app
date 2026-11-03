import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: { rubro: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() } },
}))

import { GET, POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any
const post = (body: any) => ({ json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/api/lista-compras/rubros', () => {
  it('GET lista por nombre, con la cantidad de artículos que la usan', async () => {
    mp.rubro.findMany.mockResolvedValue([{ id: 1, nombre: 'Almacén', _count: { articulos: 4 } }])
    const res = await GET()
    expect(mp.rubro.findMany.mock.calls[0][0].orderBy).toEqual({ nombre: 'asc' })
    expect(await res.json()).toEqual([{ id: 1, nombre: 'Almacén', uso: 4 }])
  })

  it('POST 400 con nombre vacío, sin tocar la DB', async () => {
    expect((await POST(post({ nombre: '  ' }))).status).toBe(400)
    expect(mp.rubro.findFirst).not.toHaveBeenCalled()
  })

  it('POST crea una rubro nueva (201)', async () => {
    mp.rubro.findFirst.mockResolvedValue(null)
    mp.rubro.create.mockResolvedValue({ id: 8, nombre: 'Limpieza' })
    const res = await POST(post({ nombre: ' Limpieza ' }))
    expect(res.status).toBe(201)
    expect(mp.rubro.create).toHaveBeenCalledWith({ data: { nombre: 'Limpieza' } })
    expect(await res.json()).toEqual({ id: 8, nombre: 'Limpieza' })
  })

  it('POST con un nombre existente (sin distinguir mayúsculas) devuelve la existente con 200', async () => {
    mp.rubro.findFirst.mockResolvedValue({ id: 1, nombre: 'Almacén' })
    const res = await POST(post({ nombre: 'ALMACÉN' }))
    expect(mp.rubro.findFirst.mock.calls[0][0].where).toEqual({ nombre: { equals: 'ALMACÉN', mode: 'insensitive' } })
    expect(mp.rubro.create).not.toHaveBeenCalled()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 1, nombre: 'Almacén' })
  })

  it('POST ante una carrera (P2002) devuelve la que creó el otro request', async () => {
    mp.rubro.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 9, nombre: 'Bebidas' })
    mp.rubro.create.mockRejectedValue({ code: 'P2002' })
    const res = await POST(post({ nombre: 'Bebidas' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 9, nombre: 'Bebidas' })
  })
})
