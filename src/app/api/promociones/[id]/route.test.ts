import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    promocion: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    concepto: { findUnique: vi.fn() },
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

  it('reemplaza las tarjetas con set (no las acumula)', async () => {
    mp.promocion.findUnique.mockResolvedValue({ id: 1 })
    mp.promocion.update.mockResolvedValue({ id: 1, lugar: 'Coto', tarjetas: [], dias: [1] })
    const res = await PUT(body(ok), params('1'))
    expect(res.status).toBe(200)
    expect(mp.promocion.update.mock.calls[0][0]).toMatchObject({
      where: { id: 1 },
      data: { lugar: 'Coto', topeMensual: 8000, tarjetas: { set: [{ id: 10 }, { id: 11 }] }, conceptoId: null },
    })
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
