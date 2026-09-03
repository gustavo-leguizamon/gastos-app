import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: { tarjeta: { update: vi.fn(), delete: vi.fn() } },
}))

import { PUT } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const req = (body: unknown) => ({ json: async () => body }) as any
const params = { params: { id: '7' } }

const actualizada = (bajaMes: number | null, bajaAnio: number | null) => ({
  id: 7, nombre: 'Visa', banco: null, marca: null, bancoLogo: null, bancoIcono: null,
  bajaMes, bajaAnio,
})

beforeEach(() => { vi.clearAllMocks() })

describe('PUT /api/tarjetas/[id]', () => {
  it('da de baja la tarjeta desde el período indicado', async () => {
    mp.tarjeta.update.mockResolvedValue(actualizada(8, 2026))

    const res = await PUT(req({ nombre: 'Visa', baja_mes: 8, baja_anio: 2026 }), params)

    expect(mp.tarjeta.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 7 },
      data: expect.objectContaining({ bajaMes: 8, bajaAnio: 2026 }),
    }))
    expect(await res.json()).toMatchObject({ baja_mes: 8, baja_anio: 2026 })
  })

  it('mandar la baja vacía la revierte (es el camino para rehabilitarla)', async () => {
    mp.tarjeta.update.mockResolvedValue(actualizada(null, null))

    const res = await PUT(req({ nombre: 'Visa', baja_mes: null, baja_anio: null }), params)

    expect(mp.tarjeta.update.mock.calls[0][0].data).toMatchObject({ bajaMes: null, bajaAnio: null })
    expect(await res.json()).toMatchObject({ baja_mes: null, baja_anio: null })
  })

  it('un período inválido no deja la tarjeta con un corte a medias', async () => {
    mp.tarjeta.update.mockResolvedValue(actualizada(null, null))

    await PUT(req({ nombre: 'Visa', baja_mes: 13, baja_anio: 2026 }), params)

    expect(mp.tarjeta.update.mock.calls[0][0].data).toMatchObject({ bajaMes: null, bajaAnio: null })
  })
})
