import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    listaCompraItem: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    listaCompraCompra: { count: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any
const req = (body: any) => ({ json: async () => body }) as any
const ctx = (id: string) => ({ params: { id } })

const body = { cantidad: 3, precio_unitario: 1100, fecha: '2026-11-03' }

/** La línea tal como la devuelve `cargarItemResponse` (segundo findUnique). */
const lineaCompleta = {
  id: 1, articuloId: 7, mes: 11, anio: 2026, cantidad: 5, precioUnitario: 1060, cantidadComprada: 5,
  articulo: { id: 7, nombre: 'Yerba', unidadId: 2, unidad: { id: 2, nombre: 'kg', subunidadDe: null }, rubroId: null, rubro: null },
  compras: [
    { id: 10, itemId: 1, cantidad: 2, precioUnitario: 1000, fecha: '2026-11-01' },
    { id: 11, itemId: 1, cantidad: 3, precioUnitario: 1100, fecha: '2026-11-03' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  mp.listaCompraItem.findUnique
    .mockResolvedValueOnce({ id: 1, articuloId: 7, cantidadComprada: 0, precioUnitario: null }) // la línea
    .mockResolvedValueOnce(lineaCompleta) // cargarItemResponse
  mp.listaCompraCompra.count.mockResolvedValue(0)
  mp.listaCompraCompra.findMany.mockResolvedValue([
    { cantidad: 2, precioUnitario: 1000 },
    { cantidad: 3, precioUnitario: 1100 },
  ])
  mp.listaCompraItem.findMany.mockResolvedValue([])
})

describe('POST /api/lista-compras/[id]/compras', () => {
  it('400 con id o body inválido, sin tocar la DB', async () => {
    expect((await POST(req(body), ctx('x'))).status).toBe(400)
    expect((await POST(req({ ...body, cantidad: 0 }), ctx('1'))).status).toBe(400)
    expect((await POST(req({ ...body, fecha: undefined }), ctx('1'))).status).toBe(400)
    expect(mp.listaCompraItem.findUnique).not.toHaveBeenCalled()
  })

  it('404 si la línea no existe', async () => {
    mp.listaCompraItem.findUnique.mockReset().mockResolvedValue(null)
    expect((await POST(req(body), ctx('1'))).status).toBe(404)
    expect(mp.listaCompraCompra.create).not.toHaveBeenCalled()
  })

  it('crea la compra, recalcula la línea (suma + promedio ponderado) y devuelve la línea con sus compras', async () => {
    const res = await POST(req(body), ctx('1'))
    expect(res.status).toBe(201)
    expect(mp.listaCompraCompra.create).toHaveBeenCalledTimes(1)
    expect(mp.listaCompraCompra.create.mock.calls[0][0].data).toEqual({ itemId: 1, cantidad: 3, precioUnitario: 1100, fecha: '2026-11-03' })

    const upd = mp.listaCompraItem.update.mock.calls[0][0]
    expect(upd.where).toEqual({ id: 1 })
    expect(upd.data.cantidadComprada).toBe(5)
    expect(upd.data.precioUnitario).toBeCloseTo(1060)

    const json = await res.json()
    expect(json.compras).toHaveLength(2)
    expect(json.comprado).toBe(true)
  })

  it('si la línea ya llevaba una cantidad a mano, la convierte en una compra inicial antes de la nueva', async () => {
    mp.listaCompraItem.findUnique.mockReset()
      .mockResolvedValueOnce({ id: 1, articuloId: 7, cantidadComprada: 2, precioUnitario: 1000 })
      .mockResolvedValueOnce(lineaCompleta)
    await POST(req(body), ctx('1'))
    expect(mp.listaCompraCompra.create).toHaveBeenCalledTimes(2)
    expect(mp.listaCompraCompra.create.mock.calls[0][0].data).toEqual({ itemId: 1, cantidad: 2, precioUnitario: 1000, fecha: '2026-11-03' })
    expect(mp.listaCompraCompra.create.mock.calls[1][0].data.cantidad).toBe(3)
  })

  it('no vuelve a crear la compra inicial si la línea ya tenía compras', async () => {
    mp.listaCompraItem.findUnique.mockReset()
      .mockResolvedValueOnce({ id: 1, articuloId: 7, cantidadComprada: 2, precioUnitario: 1000 })
      .mockResolvedValueOnce(lineaCompleta)
    mp.listaCompraCompra.count.mockResolvedValue(1)
    await POST(req(body), ctx('1'))
    expect(mp.listaCompraCompra.create).toHaveBeenCalledTimes(1)
  })

  it('si ninguna compra tiene precio, no toca el precio de la línea', async () => {
    mp.listaCompraCompra.findMany.mockResolvedValue([{ cantidad: 3, precioUnitario: null }])
    await POST(req({ cantidad: 3, fecha: '2026-11-03' }), ctx('1'))
    const upd = mp.listaCompraItem.update.mock.calls[0][0]
    expect(upd.data).toEqual({ cantidadComprada: 3 })
    expect('precioUnitario' in upd.data).toBe(false)
  })
})
