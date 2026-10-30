import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    promocion: { findUnique: vi.fn() },
    promocionReintegro: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}))

import { PUT } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any
const body = (b: any) => ({ json: async () => b }) as any
const params = (id: string) => ({ params: { id } })

const ok = { mes: 10, anio: 2026, vence_el: '2026-12-15', utilizado: false }

beforeEach(() => {
  vi.clearAllMocks()
  mp.promocion.findUnique.mockResolvedValue({ id: 1 })
})

describe('PUT /api/promociones/[id]/reintegro', () => {
  it('400 con id o body inválido, sin tocar la DB', async () => {
    expect((await PUT(body(ok), params('x'))).status).toBe(400)
    expect((await PUT(body({ ...ok, mes: 13 }), params('1'))).status).toBe(400)
    expect((await PUT(body({ ...ok, vence_el: 'mañana' }), params('1'))).status).toBe(400)
    expect(mp.promocionReintegro.upsert).not.toHaveBeenCalled()
  })

  it('404 si la promo no existe', async () => {
    mp.promocion.findUnique.mockResolvedValue(null)
    expect((await PUT(body(ok), params('9'))).status).toBe(404)
    expect(mp.promocionReintegro.upsert).not.toHaveBeenCalled()
  })

  it('upsertea sobre (promoción, mes, año): un vencimiento por mes', async () => {
    mp.promocionReintegro.upsert.mockResolvedValue({ venceEl: '2026-12-15', utilizado: false })
    const res = await PUT(body(ok), params('1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ vence_el: '2026-12-15', utilizado: false })
    expect(mp.promocionReintegro.upsert).toHaveBeenCalledWith({
      where: { promocionId_mes_anio: { promocionId: 1, mes: 10, anio: 2026 } },
      create: { promocionId: 1, mes: 10, anio: 2026, venceEl: '2026-12-15', utilizado: false },
      update: { venceEl: '2026-12-15', utilizado: false },
    })
  })

  it('marcar como utilizado conserva la fecha', async () => {
    mp.promocionReintegro.upsert.mockResolvedValue({ venceEl: '2026-12-15', utilizado: true })
    await PUT(body({ ...ok, utilizado: true }), params('1'))
    expect(mp.promocionReintegro.upsert.mock.calls[0][0].update).toEqual({ venceEl: '2026-12-15', utilizado: true })
  })

  it('sin fecha y sin utilizado borra la fila en vez de guardar una vacía', async () => {
    const res = await PUT(body({ mes: 10, anio: 2026, vence_el: '', utilizado: false }), params('1'))
    expect(await res.json()).toBeNull()
    expect(mp.promocionReintegro.deleteMany).toHaveBeenCalledWith({ where: { promocionId: 1, mes: 10, anio: 2026 } })
    expect(mp.promocionReintegro.upsert).not.toHaveBeenCalled()
  })
})
