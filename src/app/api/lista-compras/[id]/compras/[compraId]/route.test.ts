import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    listaCompraItem: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    listaCompraCompra: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
  },
}))

import { PUT, DELETE } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any
const req = (body: any) => ({ json: async () => body }) as any
const ctx = (id: string, compraId: string) => ({ params: { id, compraId } })

const body = { cantidad: 4, precio_unitario: 900, fecha: '2026-11-05' }

const linea = {
  id: 1, articuloId: 7, mes: 11, anio: 2026, cantidad: 5, precioUnitario: 900, cantidadComprada: 4,
  articulo: { id: 7, nombre: 'Yerba', unidadId: 2, unidad: { id: 2, nombre: 'kg', subunidadDe: null }, rubroId: null, rubro: null },
  compras: [{ id: 10, itemId: 1, cantidad: 4, precioUnitario: 900, fecha: '2026-11-05' }],
}

beforeEach(() => {
  vi.clearAllMocks()
  mp.listaCompraCompra.findFirst.mockResolvedValue({ id: 10, itemId: 1 })
  mp.listaCompraCompra.findMany.mockResolvedValue([{ cantidad: 4, precioUnitario: 900 }])
  mp.listaCompraItem.findUnique.mockResolvedValue(linea)
  mp.listaCompraItem.findMany.mockResolvedValue([])
})

describe('PUT /api/lista-compras/[id]/compras/[compraId]', () => {
  it('400 con ids o body inválidos', async () => {
    expect((await PUT(req(body), ctx('x', '10'))).status).toBe(400)
    expect((await PUT(req(body), ctx('1', '0'))).status).toBe(400)
    expect((await PUT(req({ ...body, cantidad: -1 }), ctx('1', '10'))).status).toBe(400)
    expect(mp.listaCompraCompra.findFirst).not.toHaveBeenCalled()
  })

  it('404 si la compra no es de esa línea (se busca por los dos ids)', async () => {
    mp.listaCompraCompra.findFirst.mockResolvedValue(null)
    expect((await PUT(req(body), ctx('1', '10'))).status).toBe(404)
    expect(mp.listaCompraCompra.findFirst).toHaveBeenCalledWith({ where: { id: 10, itemId: 1 } })
    expect(mp.listaCompraCompra.update).not.toHaveBeenCalled()
  })

  it('actualiza la compra y recalcula la línea', async () => {
    const res = await PUT(req(body), ctx('1', '10'))
    expect(res.status).toBe(200)
    expect(mp.listaCompraCompra.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { cantidad: 4, precioUnitario: 900, fecha: '2026-11-05' },
    })
    expect(mp.listaCompraItem.update.mock.calls[0][0].data).toEqual({ cantidadComprada: 4, precioUnitario: 900 })
  })
})

describe('DELETE /api/lista-compras/[id]/compras/[compraId]', () => {
  it('400 con ids inválidos y 404 si no es de esa línea, sin borrar', async () => {
    expect((await DELETE({} as any, ctx('1', 'x'))).status).toBe(400)
    mp.listaCompraCompra.findFirst.mockResolvedValue(null)
    expect((await DELETE({} as any, ctx('1', '10'))).status).toBe(404)
    expect(mp.listaCompraCompra.delete).not.toHaveBeenCalled()
  })

  it('borra la compra y recalcula la línea', async () => {
    mp.listaCompraCompra.findMany.mockResolvedValue([{ cantidad: 2, precioUnitario: 1000 }])
    await DELETE({} as any, ctx('1', '10'))
    expect(mp.listaCompraCompra.delete).toHaveBeenCalledWith({ where: { id: 10 } })
    expect(mp.listaCompraItem.update.mock.calls[0][0].data).toEqual({ cantidadComprada: 2, precioUnitario: 1000 })
  })

  it('al borrar la última compra lo llevado vuelve a 0 y el precio se conserva', async () => {
    mp.listaCompraCompra.findMany.mockResolvedValue([])
    await DELETE({} as any, ctx('1', '10'))
    const data = mp.listaCompraItem.update.mock.calls[0][0].data
    expect(data).toEqual({ cantidadComprada: 0 })
    expect('precioUnitario' in data).toBe(false)
  })
})
