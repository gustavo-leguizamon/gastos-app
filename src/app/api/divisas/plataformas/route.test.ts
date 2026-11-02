import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    plataformaDivisa: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { GET, POST } from './route'
import { PUT, DELETE } from './[id]/route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const row = {
  id: 5,
  nombre: 'Brubank',
  monedaId: 2,
  cotizacion: 1450,
  comisionTipo: 'PORCENTAJE',
  comision: 1,
  comisionMoneda: 'ARS',
  nota: null,
  activa: true,
  updatedAt: new Date('2026-11-02T00:00:00Z'),
}
const body = { nombre: 'Brubank', moneda_id: 2, cotizacion: 1450, comision: 1 }

const get = (qs: string) => ({ url: `http://localhost/api/divisas/plataformas${qs}` }) as any
const json = (b: any) => ({ json: async () => b }) as any
const ctx = (id: string) => ({ params: { id } })

beforeEach(() => {
  vi.clearAllMocks()
  mp.plataformaDivisa.findMany.mockResolvedValue([row])
  mp.plataformaDivisa.findUnique.mockResolvedValue(row)
  mp.plataformaDivisa.create.mockResolvedValue(row)
  mp.plataformaDivisa.update.mockResolvedValue(row)
})

describe('GET /api/divisas/plataformas', () => {
  it('filtra por moneda, ordena por nombre y mapea a snake_case', async () => {
    const res = await GET(get('?moneda_id=2'))
    const arg = mp.plataformaDivisa.findMany.mock.calls[0][0]
    expect(arg.where).toEqual({ monedaId: 2 })
    expect(arg.orderBy).toEqual([{ nombre: 'asc' }, { id: 'asc' }])
    expect(await res.json()).toMatchObject([{ id: 5, moneda_id: 2, comision_tipo: 'PORCENTAJE' }])
  })
})

describe('POST /api/divisas/plataformas', () => {
  it('crea con el body mapeado a camelCase', async () => {
    const res = await POST(json(body))
    expect(res.status).toBe(201)
    expect(mp.plataformaDivisa.create.mock.calls[0][0].data).toMatchObject({
      nombre: 'Brubank',
      monedaId: 2,
      cotizacion: 1450,
      comisionTipo: 'PORCENTAJE',
      comision: 1,
    })
  })

  it('400 sin tocar la DB si el body es inválido', async () => {
    const res = await POST(json({ ...body, cotizacion: 0 }))
    expect(res.status).toBe(400)
    expect(mp.plataformaDivisa.create).not.toHaveBeenCalled()
  })
})

describe('PUT/DELETE /api/divisas/plataformas/[id]', () => {
  it('PUT actualiza', async () => {
    const res = await PUT(json(body), ctx('5'))
    expect(res.status).toBe(200)
    expect(mp.plataformaDivisa.update.mock.calls[0][0].where).toEqual({ id: 5 })
  })

  it('400 con id o body inválido, 404 si no existe — sin escribir', async () => {
    expect((await PUT(json(body), ctx('x'))).status).toBe(400)
    expect((await PUT(json({ nombre: '' }), ctx('5'))).status).toBe(400)
    mp.plataformaDivisa.findUnique.mockResolvedValue(null)
    expect((await PUT(json(body), ctx('5'))).status).toBe(404)
    expect((await DELETE({} as any, ctx('5'))).status).toBe(404)
    expect(mp.plataformaDivisa.update).not.toHaveBeenCalled()
    expect(mp.plataformaDivisa.delete).not.toHaveBeenCalled()
  })

  it('DELETE borra', async () => {
    const res = await DELETE({} as any, ctx('5'))
    expect(res.status).toBe(200)
    expect(mp.plataformaDivisa.delete).toHaveBeenCalledWith({ where: { id: 5 } })
  })
})
