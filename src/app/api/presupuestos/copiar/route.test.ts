import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    presupuesto: { findMany: vi.fn(), createMany: vi.fn() },
  },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any
const req = (b: any) => ({ json: async () => b }) as any

beforeEach(() => {
  vi.clearAllMocks()
  mp.presupuesto.createMany.mockResolvedValue({ count: 0 })
})

describe('POST /api/presupuestos/copiar', () => {
  it('copia los topes del mes anterior', async () => {
    mp.presupuesto.findMany
      .mockResolvedValueOnce([
        { categoriaId: 1, monto: 5000 },
        { categoriaId: 2, monto: 3000 },
      ])
      .mockResolvedValueOnce([])

    const res = await POST(req({ mes: 7, anio: 2026 }))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, origen: { mes: 6, anio: 2026 }, copiados: 2, omitidos: 0 })
    expect(mp.presupuesto.createMany).toHaveBeenCalledWith({
      data: [
        { categoriaId: 1, mes: 7, anio: 2026, monto: 5000 },
        { categoriaId: 2, mes: 7, anio: 2026, monto: 3000 },
      ],
    })
  })

  it('el mes anterior cruza el año', async () => {
    mp.presupuesto.findMany.mockResolvedValueOnce([{ categoriaId: 1, monto: 100 }]).mockResolvedValueOnce([])
    await POST(req({ mes: 1, anio: 2026 }))
    expect(mp.presupuesto.findMany.mock.calls[0][0].where).toEqual({ mes: 12, anio: 2025 })
  })

  it('no pisa lo ya cargado en el destino', async () => {
    mp.presupuesto.findMany
      .mockResolvedValueOnce([{ categoriaId: 1, monto: 5000 }, { categoriaId: 2, monto: 3000 }])
      .mockResolvedValueOnce([{ categoriaId: 1 }])

    const data = await (await POST(req({ mes: 7, anio: 2026 }))).json()

    expect(data).toMatchObject({ copiados: 1, omitidos: 1 })
    expect(mp.presupuesto.createMany).toHaveBeenCalledWith({
      data: [{ categoriaId: 2, mes: 7, anio: 2026, monto: 3000 }],
    })
  })

  it('no llama a createMany si no queda nada por copiar', async () => {
    mp.presupuesto.findMany
      .mockResolvedValueOnce([{ categoriaId: 1, monto: 5000 }])
      .mockResolvedValueOnce([{ categoriaId: 1 }])

    const data = await (await POST(req({ mes: 7, anio: 2026 }))).json()
    expect(data).toMatchObject({ copiados: 0, omitidos: 1 })
    expect(mp.presupuesto.createMany).not.toHaveBeenCalled()
  })

  it('409 si el mes anterior no tiene presupuestos', async () => {
    mp.presupuesto.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    const res = await POST(req({ mes: 7, anio: 2026 }))
    expect(res.status).toBe(409)
    expect(mp.presupuesto.createMany).not.toHaveBeenCalled()
  })

  it('400 con período inválido, sin tocar la DB', async () => {
    for (const b of [{}, { mes: 13, anio: 2026 }, { mes: 7 }]) {
      expect((await POST(req(b))).status).toBe(400)
    }
    expect(mp.presupuesto.findMany).not.toHaveBeenCalled()
  })
})
