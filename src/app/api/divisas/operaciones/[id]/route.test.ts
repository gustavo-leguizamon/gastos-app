import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    operacionDivisa: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

import { PUT, DELETE } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const row = {
  id: 1,
  fecha: '2026-01-10',
  tipo: 'compra',
  monedaId: 2,
  moneda: { id: 2, codigo: 'USD', simbolo: 'US$' },
  cantidad: 100,
  cotizacion: 1000,
  comision: 0,
  comisionMoneda: 'ARS',
  plataforma: null,
  descripcion: null,
  createdAt: new Date('2026-01-10T12:00:00Z'),
  updatedAt: new Date('2026-01-10T12:00:00Z'),
}

const put = (body: any) => ({ json: async () => body }) as any
const ctx = (id: string) => ({ params: { id } })

const valido = { fecha: '2026-01-11', tipo: 'venta', moneda_id: 2, cantidad: 50, cotizacion: 1500 }

beforeEach(() => {
  vi.clearAllMocks()
  mp.operacionDivisa.findUnique.mockResolvedValue(row)
  mp.operacionDivisa.update.mockResolvedValue(row)
})

describe('PUT /api/divisas/operaciones/[id]', () => {
  it('actualiza mapeando el body a camelCase', async () => {
    await PUT(put(valido), ctx('1'))
    expect(mp.operacionDivisa.update.mock.calls[0][0]).toMatchObject({
      where: { id: 1 },
      data: { fecha: '2026-01-11', tipo: 'venta', monedaId: 2, cantidad: 50, cotizacion: 1500 },
    })
  })

  it('devuelve 400 con id inválido sin tocar la DB', async () => {
    const res = await PUT(put(valido), ctx('abc'))
    expect(res.status).toBe(400)
    expect(mp.operacionDivisa.findUnique).not.toHaveBeenCalled()
  })

  it('devuelve 400 con body inválido sin actualizar', async () => {
    const res = await PUT(put({ ...valido, cantidad: 0 }), ctx('1'))
    expect(res.status).toBe(400)
    expect(mp.operacionDivisa.update).not.toHaveBeenCalled()
  })

  it('devuelve 404 si la operación no existe', async () => {
    mp.operacionDivisa.findUnique.mockResolvedValue(null)
    const res = await PUT(put(valido), ctx('9'))
    expect(res.status).toBe(404)
    expect(mp.operacionDivisa.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/divisas/operaciones/[id]', () => {
  it('borra la operación', async () => {
    const res = await DELETE({} as any, ctx('1'))
    expect(res.status).toBe(200)
    expect(mp.operacionDivisa.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  it('devuelve 400 con id inválido sin tocar la DB', async () => {
    const res = await DELETE({} as any, ctx('0'))
    expect(res.status).toBe(400)
    expect(mp.operacionDivisa.delete).not.toHaveBeenCalled()
  })

  it('devuelve 404 si la operación no existe, sin borrar nada', async () => {
    mp.operacionDivisa.findUnique.mockResolvedValue(null)
    const res = await DELETE({} as any, ctx('9'))
    expect(res.status).toBe(404)
    expect(mp.operacionDivisa.delete).not.toHaveBeenCalled()
  })
})
