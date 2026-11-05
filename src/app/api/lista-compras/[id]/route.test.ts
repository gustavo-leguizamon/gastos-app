import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    listaCompraItem: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
    articulo: { update: vi.fn(), findFirst: vi.fn() },
    listaCompraCompra: { count: vi.fn() },
    unidad: { findUnique: vi.fn() },
    rubro: { findUnique: vi.fn() },
  },
}))

import { PUT, DELETE } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any
const req = (body: any) => ({ json: async () => body }) as any
const ctx = (id: string) => ({ params: { id } })

const fila = {
  id: 1, articuloId: 7, mes: 11, anio: 2026, cantidad: 2, precioUnitario: 1000, cantidadComprada: 2,
  articulo: { id: 7, nombre: 'Leche', unidadId: 2, unidad: { id: 2, nombre: 'l' }, rubroId: null, rubro: null },
}

beforeEach(() => {
  vi.clearAllMocks()
  mp.listaCompraItem.findUnique.mockResolvedValue({ id: 1, articuloId: 7, cantidad: 4 })
  mp.listaCompraItem.update.mockResolvedValue(fila)
  mp.listaCompraItem.findMany.mockResolvedValue([])
  mp.unidad.findUnique.mockResolvedValue({ id: 3 })
  mp.listaCompraCompra.count.mockResolvedValue(0)
  mp.rubro.findUnique.mockResolvedValue({ id: 5 })
  mp.articulo.findFirst.mockResolvedValue(null)
})

describe('PUT /api/lista-compras/[id]', () => {
  it('renombra el artículo (normalizado), no la línea', async () => {
    expect((await PUT(req({ nombre: '  Leche  entera ' }), ctx('1'))).status).toBe(200)
    expect(mp.articulo.findFirst.mock.calls[0][0].where).toEqual({
      nombre: { equals: 'Leche entera', mode: 'insensitive' }, NOT: { id: 7 },
    })
    expect(mp.articulo.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { nombre: 'Leche entera' } })
    expect(mp.listaCompraItem.update.mock.calls[0][0].data).toEqual({})
  })

  it('la preferencia de ver en kg/l va al artículo, aunque la línea tenga compras', async () => {
    mp.listaCompraCompra.count.mockResolvedValue(2)
    expect((await PUT(req({ mostrar_en_multiplo: true }), ctx('1'))).status).toBe(200)
    expect(mp.articulo.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { mostrarEnMultiplo: true } })
    expect(mp.listaCompraItem.update.mock.calls[0][0].data).toEqual({})
  })

  it('renombrar se permite aunque la línea tenga compras', async () => {
    mp.listaCompraCompra.count.mockResolvedValue(3)
    expect((await PUT(req({ nombre: 'Leche entera' }), ctx('1'))).status).toBe(200)
    expect(mp.articulo.update).toHaveBeenCalled()
  })

  it('409 si otro artículo ya tiene ese nombre, sin tocar nada', async () => {
    mp.articulo.findFirst.mockResolvedValue({ id: 9, nombre: 'Leche' })
    expect((await PUT(req({ nombre: 'leche' }), ctx('1'))).status).toBe(409)
    expect(mp.articulo.update).not.toHaveBeenCalled()
    expect(mp.listaCompraItem.update).not.toHaveBeenCalled()
  })

  it('400 con id o body inválido', async () => {
    expect((await PUT(req({ comprado: true }), ctx('x'))).status).toBe(400)
    expect((await PUT(req({}), ctx('1'))).status).toBe(400)
    expect(mp.listaCompraItem.update).not.toHaveBeenCalled()
  })

  it('404 si la línea no existe', async () => {
    mp.listaCompraItem.findUnique.mockResolvedValue(null)
    expect((await PUT(req({ comprado: true }), ctx('1'))).status).toBe(404)
    expect(mp.listaCompraItem.update).not.toHaveBeenCalled()
  })

  it('cantidad/precio/cantidad_comprada van a la línea, no al artículo', async () => {
    await PUT(req({ cantidad: 3, precio_unitario: 1200, cantidad_comprada: 1 }), ctx('1'))
    expect(mp.listaCompraItem.update.mock.calls[0][0].data).toEqual({ cantidad: 3, precioUnitario: 1200, cantidadComprada: 1 })
    expect(mp.articulo.update).not.toHaveBeenCalled()
  })

  it('cargar compras parciales: guarda el acumulado tal cual', async () => {
    await PUT(req({ cantidad_comprada: 2.5 }), ctx('1'))
    expect(mp.listaCompraItem.update.mock.calls[0][0].data).toEqual({ cantidadComprada: 2.5 })
  })

  it('el atajo comprado:true marca todo lo pedido y no persiste `comprado`', async () => {
    await PUT(req({ comprado: true }), ctx('1'))
    expect(mp.listaCompraItem.update.mock.calls[0][0].data).toEqual({ cantidadComprada: 4 })
  })

  it('el atajo comprado:false deja la cantidad llevada en 0', async () => {
    await PUT(req({ comprado: false }), ctx('1'))
    expect(mp.listaCompraItem.update.mock.calls[0][0].data).toEqual({ cantidadComprada: 0 })
  })

  describe('con compras registradas', () => {
    beforeEach(() => mp.listaCompraCompra.count.mockResolvedValue(2))

    it.each([
      [{ cantidad_comprada: 3 }],
      [{ comprado: true }],
      [{ precio_unitario: 500 }],
    ])('409 si se edita a mano lo que sale de las compras: %j', async (body) => {
      const res = await PUT(req(body), ctx('1'))
      expect(res.status).toBe(409)
      expect(mp.listaCompraItem.update).not.toHaveBeenCalled()
    })

    it('lo que no sale de las compras (cantidad pedida, rubro) se sigue pudiendo editar', async () => {
      expect((await PUT(req({ cantidad: 6 }), ctx('1'))).status).toBe(200)
      expect(mp.listaCompraItem.update.mock.calls[0][0].data).toEqual({ cantidad: 6 })
    })
  })

  it('sin compras no consulta el conteo si el cambio no toca lo llevado ni el precio', async () => {
    await PUT(req({ cantidad: 6 }), ctx('1'))
    expect(mp.listaCompraCompra.count).not.toHaveBeenCalled()
  })

  it('400 con una cantidad_comprada negativa', async () => {
    expect((await PUT(req({ cantidad_comprada: -1 }), ctx('1'))).status).toBe(400)
    expect(mp.listaCompraItem.update).not.toHaveBeenCalled()
  })

  it('precio_unitario null borra el precio', async () => {
    await PUT(req({ precio_unitario: null }), ctx('1'))
    expect(mp.listaCompraItem.update.mock.calls[0][0].data).toEqual({ precioUnitario: null })
  })

  it('unidad y rubro se guardan en el artículo (valen para todos los meses)', async () => {
    await PUT(req({ unidad_id: 3, rubro_id: 5 }), ctx('1'))
    expect(mp.articulo.update.mock.calls[0][0]).toEqual({ where: { id: 7 }, data: { unidadId: 3, rubroId: 5 } })
    expect(mp.listaCompraItem.update.mock.calls[0][0].data).toEqual({})
  })

  it('rubro_id null quita el rubro sin validar contra la tabla', async () => {
    await PUT(req({ rubro_id: null }), ctx('1'))
    expect(mp.rubro.findUnique).not.toHaveBeenCalled()
    expect(mp.articulo.update.mock.calls[0][0].data).toEqual({ rubroId: null })
  })

  it('400 si la unidad o el rubro no existen, sin actualizar nada', async () => {
    mp.unidad.findUnique.mockResolvedValueOnce(null)
    expect((await PUT(req({ unidad_id: 99 }), ctx('1'))).status).toBe(400)
    mp.rubro.findUnique.mockResolvedValueOnce(null)
    expect((await PUT(req({ rubro_id: 99 }), ctx('1'))).status).toBe(400)
    expect(mp.articulo.update).not.toHaveBeenCalled()
    expect(mp.listaCompraItem.update).not.toHaveBeenCalled()
  })

  it('la respuesta trae la referencia de compras anteriores', async () => {
    mp.listaCompraItem.findMany.mockResolvedValue([{ cantidad: 1, precioUnitario: 800, mes: 10, anio: 2026 }])
    const body = await (await PUT(req({ comprado: true }), ctx('1'))).json()
    expect(body.referencia).toEqual({ precio_unitario: 800, cantidad: 1, mes: 10, anio: 2026 })
  })
})

describe('DELETE /api/lista-compras/[id]', () => {
  it('400 / 404 sin borrar', async () => {
    expect((await DELETE({} as any, ctx('0'))).status).toBe(400)
    mp.listaCompraItem.findUnique.mockResolvedValue(null)
    expect((await DELETE({} as any, ctx('1'))).status).toBe(404)
    expect(mp.listaCompraItem.delete).not.toHaveBeenCalled()
  })

  it('borra sólo la línea del mes', async () => {
    const res = await DELETE({} as any, ctx('1'))
    expect(mp.listaCompraItem.delete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(await res.json()).toEqual({ ok: true })
  })
})
