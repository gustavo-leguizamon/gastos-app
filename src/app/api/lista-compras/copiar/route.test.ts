import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    listaCompraItem: { findFirst: vi.fn(), findMany: vi.fn(), createMany: vi.fn() },
  },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any
const req = (body: any) => ({ json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/lista-compras/copiar', () => {
  it('400 con período inválido', async () => {
    expect((await POST(req({ mes: 0, anio: 2026 }))).status).toBe(400)
    expect(mp.listaCompraItem.findFirst).not.toHaveBeenCalled()
  })

  it('404 si no hay ninguna lista anterior', async () => {
    mp.listaCompraItem.findFirst.mockResolvedValue(null)
    expect((await POST(req({ mes: 11, anio: 2026 }))).status).toBe(404)
    expect(mp.listaCompraItem.createMany).not.toHaveBeenCalled()
  })

  it('copia del último mes anterior con lista: cantidades sí, precios y comprado no', async () => {
    mp.listaCompraItem.findFirst.mockResolvedValue({ mes: 9, anio: 2026 }) // se salteó octubre
    mp.listaCompraItem.findMany
      .mockResolvedValueOnce([{ articuloId: 1, cantidad: 2 }, { articuloId: 2, cantidad: 0.5 }])
      .mockResolvedValueOnce([])
    const res = await POST(req({ mes: 11, anio: 2026 }))

    const q = mp.listaCompraItem.findFirst.mock.calls[0][0]
    expect(q.where).toEqual({ OR: [{ anio: { lt: 2026 } }, { anio: 2026, mes: { lt: 11 } }] })
    expect(q.orderBy).toEqual([{ anio: 'desc' }, { mes: 'desc' }])
    expect(mp.listaCompraItem.createMany.mock.calls[0][0].data).toEqual([
      { articuloId: 1, mes: 11, anio: 2026, cantidad: 2 },
      { articuloId: 2, mes: 11, anio: 2026, cantidad: 0.5 },
    ])
    expect(await res.json()).toEqual({ copiados: 2, omitidos: 0, origen: { mes: 9, anio: 2026 } })
  })

  it('no pisa lo ya cargado en el mes destino', async () => {
    mp.listaCompraItem.findFirst.mockResolvedValue({ mes: 10, anio: 2026 })
    mp.listaCompraItem.findMany
      .mockResolvedValueOnce([{ articuloId: 1, cantidad: 2 }, { articuloId: 2, cantidad: 1 }])
      .mockResolvedValueOnce([{ articuloId: 1 }])
    const res = await POST(req({ mes: 11, anio: 2026 }))
    expect(mp.listaCompraItem.createMany.mock.calls[0][0].data).toEqual([
      { articuloId: 2, mes: 11, anio: 2026, cantidad: 1 },
    ])
    expect(await res.json()).toMatchObject({ copiados: 1, omitidos: 1 })
  })

  it('si todo estaba ya cargado no llama a createMany', async () => {
    mp.listaCompraItem.findFirst.mockResolvedValue({ mes: 10, anio: 2026 })
    mp.listaCompraItem.findMany
      .mockResolvedValueOnce([{ articuloId: 1, cantidad: 2 }])
      .mockResolvedValueOnce([{ articuloId: 1 }])
    await POST(req({ mes: 11, anio: 2026 }))
    expect(mp.listaCompraItem.createMany).not.toHaveBeenCalled()
  })
})
