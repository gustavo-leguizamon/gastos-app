import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    movimiento: { update: vi.fn(), delete: vi.fn() },
  },
}))

import { PUT, DELETE } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const row = {
  id: 7,
  inversionId: 3,
  fecha: '2026-08-26',
  montoActual: 1500,
  movimiento: 500,
  descripcion: 'aporte mensual',
  createdAt: new Date('2026-08-26T10:00:00Z'),
}

const put = (body: any) => ({ json: async () => body }) as any
const params = { params: { id: '3', movId: '7' } }

beforeEach(() => {
  vi.clearAllMocks()
  mp.movimiento.update.mockImplementation(async ({ data }: any) => ({ ...row, ...data }))
  mp.movimiento.delete.mockResolvedValue(row)
})

describe('PUT /api/inversiones/[id]/movimientos/[movId]', () => {
  it('actualiza la descripción junto con los montos', async () => {
    const res = await PUT(
      put({ fecha: '2026-08-27', monto_actual: 1600, movimiento: 100, descripcion: ' rescate parcial ' }),
      params,
    )
    expect(mp.movimiento.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        fecha: '2026-08-27',
        montoActual: 1600,
        movimiento: 100,
        descripcion: 'rescate parcial',
      },
    })
    const json = await res.json()
    expect(json).toMatchObject({ id: 7, inversion_id: 3, descripcion: 'rescate parcial' })
  })

  it('vaciar el campo borra la descripción (null, no "")', async () => {
    await PUT(put({ fecha: '2026-08-26', monto_actual: 1500, movimiento: 0, descripcion: '' }), params)
    expect(mp.movimiento.update.mock.calls[0][0].data.descripcion).toBeNull()
  })
})

describe('DELETE /api/inversiones/[id]/movimientos/[movId]', () => {
  it('borra por id de movimiento', async () => {
    const res = await DELETE({} as any, params)
    expect(mp.movimiento.delete).toHaveBeenCalledWith({ where: { id: 7 } })
    expect(await res.json()).toEqual({ ok: true })
  })
})
