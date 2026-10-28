import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    promocion: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    concepto: { count: vi.fn() },
    tarjeta: { count: vi.fn() },
  },
}))

import { PUT, DELETE } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any
const body = (b: any) => ({ json: async () => b }) as any
const params = (id: string) => ({ params: { id } })

const ok = { lugar: 'Coto', porcentaje: 15, tope_mensual: 8000, dias: [1], tarjeta_ids: [10, 11], efectivo: false }

beforeEach(() => {
  vi.clearAllMocks()
  mp.tarjeta.count.mockResolvedValue(2)
})

describe('PUT /api/promociones/[id]', () => {
  it('400 con id o body inválido', async () => {
    expect((await PUT(body(ok), params('x'))).status).toBe(400)
    expect((await PUT(body({ ...ok, porcentaje: 0 }), params('1'))).status).toBe(400)
    expect(mp.promocion.update).not.toHaveBeenCalled()
  })

  it('404 si no existe, sin actualizar', async () => {
    mp.promocion.findUnique.mockResolvedValue(null)
    expect((await PUT(body(ok), params('9'))).status).toBe(404)
    expect(mp.promocion.update).not.toHaveBeenCalled()
  })

  it('reemplaza tarjetas y conceptos con set (no los acumula); sin conceptos los deja vacíos', async () => {
    mp.promocion.findUnique.mockResolvedValue({ id: 1 })
    mp.promocion.update.mockResolvedValue({ id: 1, lugar: 'Coto', tarjetas: [], conceptos: [], dias: [1] })
    const res = await PUT(body(ok), params('1'))
    expect(res.status).toBe(200)
    expect(mp.promocion.update.mock.calls[0][0]).toMatchObject({
      where: { id: 1 },
      data: { lugar: 'Coto', topeMensual: 8000, tarjetas: { set: [{ id: 10 }, { id: 11 }] }, conceptos: { set: [] } },
    })

    mp.concepto.count.mockResolvedValue(2)
    await PUT(body({ ...ok, concepto_ids: [5, 6] }), params('1'))
    expect(mp.promocion.update.mock.calls[1][0].data.conceptos).toEqual({ set: [{ id: 5 }, { id: 6 }] })
  })

  it('400 si algún concepto no existe', async () => {
    mp.promocion.findUnique.mockResolvedValue({ id: 1 })
    mp.concepto.count.mockResolvedValue(1)
    expect((await PUT(body({ ...ok, concepto_ids: [5, 6] }), params('1'))).status).toBe(400)
    expect(mp.promocion.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/promociones/[id]', () => {
  it('400 con id inválido, 404 si no existe', async () => {
    expect((await DELETE({} as any, params('0'))).status).toBe(400)
    mp.promocion.findUnique.mockResolvedValue(null)
    expect((await DELETE({} as any, params('4'))).status).toBe(404)
    expect(mp.promocion.delete).not.toHaveBeenCalled()
  })

  it('borra la promo', async () => {
    mp.promocion.findUnique.mockResolvedValue({ id: 4 })
    expect((await DELETE({} as any, params('4'))).status).toBe(200)
    expect(mp.promocion.delete).toHaveBeenCalledWith({ where: { id: 4 } })
  })
})
