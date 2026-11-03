import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    listaCompraItem: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    articulo: { findFirst: vi.fn(), create: vi.fn() },
    unidad: { findUnique: vi.fn() },
    rubro: { findUnique: vi.fn() },
  },
}))

import { GET, POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any
const get = (qs: string) => ({ url: `http://localhost/api/lista-compras${qs}` }) as any
const post = (body: any) => ({ json: async () => body }) as any

const fila = {
  id: 1, articuloId: 7, mes: 11, anio: 2026, cantidad: 2, precioUnitario: null, cantidadComprada: 0,
  articulo: { id: 7, nombre: 'Leche', unidadId: 2, unidad: { id: 2, nombre: 'l' }, rubroId: 5, rubro: { id: 5, nombre: 'Almacén' } },
}

beforeEach(() => {
  vi.clearAllMocks()
  mp.unidad.findUnique.mockResolvedValue({ id: 2, nombre: 'l' })
  mp.rubro.findUnique.mockResolvedValue({ id: 5, nombre: 'Almacén' })
})

describe('GET /api/lista-compras', () => {
  it('400 sin período válido, sin tocar la DB', async () => {
    const res = await GET(get('?mes=13&anio=2026'))
    expect(res.status).toBe(400)
    expect(mp.listaCompraItem.findMany).not.toHaveBeenCalled()
  })

  it('trae el mes y el histórico con precio ANTERIOR al mes, en una sola query', async () => {
    mp.listaCompraItem.findMany
      .mockResolvedValueOnce([fila])
      .mockResolvedValueOnce([{ articuloId: 7, cantidad: 1, precioUnitario: 900, mes: 10, anio: 2026 }])
    const res = await GET(get('?mes=11&anio=2026'))
    const [lista, historico] = mp.listaCompraItem.findMany.mock.calls
    expect(lista[0].where).toEqual({ mes: 11, anio: 2026 })
    expect(historico[0].where).toEqual({
      articuloId: { in: [7] },
      precioUnitario: { not: null },
      OR: [{ anio: { lt: 2026 } }, { anio: 2026, mes: { lt: 11 } }],
    })
    const body = await res.json()
    expect(body.items[0].referencia).toEqual({ precio_unitario: 900, cantidad: 1, mes: 10, anio: 2026 })
    // 2 × 900 de referencia, nada gastado todavía.
    expect(body.totales).toMatchObject({ items: 1, estimado: 1800, gastado: 0 })
  })

  it('lista vacía: no consulta el histórico', async () => {
    mp.listaCompraItem.findMany.mockResolvedValueOnce([])
    await GET(get('?mes=11&anio=2026'))
    expect(mp.listaCompraItem.findMany).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/lista-compras', () => {
  it('400 si la unidad o el rubro elegidos no existen, sin crear nada', async () => {
    mp.unidad.findUnique.mockResolvedValueOnce(null)
    expect((await POST(post({ nombre: 'Leche', unidad_id: 99, mes: 11, anio: 2026 }))).status).toBe(400)
    mp.rubro.findUnique.mockResolvedValueOnce(null)
    expect((await POST(post({ nombre: 'Leche', unidad_id: 2, rubro_id: 99, mes: 11, anio: 2026 }))).status).toBe(400)
    expect(mp.articulo.create).not.toHaveBeenCalled()
    expect(mp.listaCompraItem.create).not.toHaveBeenCalled()
  })

  it('400 con body inválido, sin tocar la DB', async () => {
    const res = await POST(post({ nombre: '', unidad_id: 2, mes: 11, anio: 2026 }))
    expect(res.status).toBe(400)
    expect(mp.articulo.findFirst).not.toHaveBeenCalled()
  })

  it('reutiliza el artículo existente (case-insensitive) y crea la línea', async () => {
    mp.articulo.findFirst.mockResolvedValue({ id: 7 })
    mp.listaCompraItem.findUnique.mockResolvedValue(null)
    mp.listaCompraItem.create.mockResolvedValue(fila)
    const res = await POST(post({ nombre: 'leche', unidad_id: 2, cantidad: 2, mes: 11, anio: 2026 }))
    expect(res.status).toBe(201)
    expect(mp.articulo.findFirst.mock.calls[0][0].where).toEqual({ nombre: { equals: 'leche', mode: 'insensitive' } })
    expect(mp.articulo.create).not.toHaveBeenCalled()
    expect(mp.listaCompraItem.create.mock.calls[0][0].data).toEqual({
      articuloId: 7, mes: 11, anio: 2026, cantidad: 2, precioUnitario: null,
    })
  })

  it('crea el artículo si no existe', async () => {
    mp.articulo.findFirst.mockResolvedValue(null)
    mp.articulo.create.mockResolvedValue({ id: 9 })
    mp.listaCompraItem.findUnique.mockResolvedValue(null)
    mp.listaCompraItem.create.mockResolvedValue(fila)
    await POST(post({ nombre: 'Yerba', unidad_id: 2, rubro_id: 5, mes: 11, anio: 2026 }))
    expect(mp.articulo.create.mock.calls[0][0].data).toEqual({ nombre: 'Yerba', unidadId: 2, rubroId: 5 })
  })

  it('409 si el artículo ya está en el mes (no duplica)', async () => {
    mp.articulo.findFirst.mockResolvedValue({ id: 7 })
    mp.listaCompraItem.findUnique.mockResolvedValue(fila)
    const res = await POST(post({ nombre: 'Leche', unidad_id: 2, mes: 11, anio: 2026 }))
    expect(res.status).toBe(409)
    expect(mp.listaCompraItem.create).not.toHaveBeenCalled()
  })
})
