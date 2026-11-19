import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    promocion: { findUnique: vi.fn() },
    promocionSaldoUso: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
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

describe('POST /api/promociones/[id]/saldo-usos', () => {
  it('400 con id o body inválido y 404 si la promo no existe, sin crear', async () => {
    expect((await POST(body({ fecha: '2026-11-10', monto: 5 }), { params: { id: 'x' } })).status).toBe(400)
    expect((await POST(body({ fecha: 'x', monto: 5 }), { params: { id: '1' } })).status).toBe(400)
    expect((await POST(body({ fecha: '2026-11-10', monto: 0 }), { params: { id: '1' } })).status).toBe(400)
    mp.promocion.findUnique.mockResolvedValue(null)
    expect((await POST(body({ fecha: '2026-11-10', monto: 5 }), { params: { id: '1' } })).status).toBe(404)
    expect(mp.promocionSaldoUso.create).not.toHaveBeenCalled()
  })

  it('crea el uso del saldo y lo devuelve en snake_case', async () => {
    mp.promocion.findUnique.mockResolvedValue({ id: 1 })
    mp.promocionSaldoUso.create.mockResolvedValue({ id: 3, promocionId: 1, fecha: '2026-11-10', monto: 2000, notas: 'Súper' })
    const res = await POST(body({ fecha: '2026-11-10', monto: '2000', notas: ' Súper ' }), { params: { id: '1' } })
    expect(res.status).toBe(201)
    expect(mp.promocionSaldoUso.create).toHaveBeenCalledWith({
      data: { promocionId: 1, fecha: '2026-11-10', monto: 2000, notas: 'Súper' },
    })
    expect(await res.json()).toEqual({ id: 3, promocion_id: 1, fecha: '2026-11-10', monto: 2000, notas: 'Súper' })
  })
})

describe('DELETE /api/promociones/[id]/saldo-usos/[usoId]', () => {
  it('busca por los dos ids: no borra el uso de otra promo', async () => {
    mp.promocionSaldoUso.findFirst.mockResolvedValue(null)
    const res = await DELETE({} as any, { params: { id: '1', usoId: '7' } })
    expect(res.status).toBe(404)
    expect(mp.promocionSaldoUso.findFirst).toHaveBeenCalledWith({ where: { id: 7, promocionId: 1 } })
    expect(mp.promocionSaldoUso.delete).not.toHaveBeenCalled()
  })

  it('borra el uso', async () => {
    mp.promocionSaldoUso.findFirst.mockResolvedValue({ id: 7 })
    expect((await DELETE({} as any, { params: { id: '1', usoId: '7' } })).status).toBe(200)
    expect(mp.promocionSaldoUso.delete).toHaveBeenCalledWith({ where: { id: 7 } })
  })
})
