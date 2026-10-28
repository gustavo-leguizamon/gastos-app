import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    promocion: { findUnique: vi.fn() },
    promocionUso: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  },
}))

import { POST } from './route'
import { DELETE } from './[usoId]/route'
import { prisma } from '@/lib/db'

const mp = prisma as any
const body = (b: any) => ({ json: async () => b }) as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/promociones/[id]/usos', () => {
  it('400 con body inválido y 404 si la promo no existe, sin crear', async () => {
    expect((await POST(body({ fecha: 'x', monto_gasto: 5 }), { params: { id: '1' } })).status).toBe(400)
    mp.promocion.findUnique.mockResolvedValue(null)
    expect((await POST(body({ fecha: '2026-10-08', monto_gasto: 5 }), { params: { id: '1' } })).status).toBe(404)
    expect(mp.promocionUso.create).not.toHaveBeenCalled()
  })

  it('deriva mes/anio de la fecha', async () => {
    mp.promocion.findUnique.mockResolvedValue({ id: 1 })
    mp.promocionUso.create.mockResolvedValue({ id: 7, promocionId: 1, fecha: '2026-10-31', mes: 10, anio: 2026, montoGasto: 5000, notas: null })
    const res = await POST(body({ fecha: '2026-10-31', monto_gasto: 5000 }), { params: { id: '1' } })
    expect(res.status).toBe(201)
    expect(mp.promocionUso.create).toHaveBeenCalledWith({
      data: { promocionId: 1, fecha: '2026-10-31', mes: 10, anio: 2026, montoGasto: 5000, notas: null },
    })
  })
})

describe('DELETE /api/promociones/[id]/usos/[usoId]', () => {
  it('busca por los dos ids: no borra el uso de otra promo', async () => {
    mp.promocionUso.findFirst.mockResolvedValue(null)
    const res = await DELETE({} as any, { params: { id: '1', usoId: '7' } })
    expect(res.status).toBe(404)
    expect(mp.promocionUso.findFirst).toHaveBeenCalledWith({ where: { id: 7, promocionId: 1 } })
    expect(mp.promocionUso.delete).not.toHaveBeenCalled()
  })

  it('borra el uso', async () => {
    mp.promocionUso.findFirst.mockResolvedValue({ id: 7 })
    expect((await DELETE({} as any, { params: { id: '1', usoId: '7' } })).status).toBe(200)
    expect(mp.promocionUso.delete).toHaveBeenCalledWith({ where: { id: 7 } })
  })
})
