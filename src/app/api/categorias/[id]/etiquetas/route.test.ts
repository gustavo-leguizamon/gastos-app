import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    categoria: { findUnique: vi.fn() },
    etiqueta: { count: vi.fn() },
    categoriaEtiquetaRegla: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(async (ops: any[]) => ops),
  },
}))

import { GET, PUT } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const reqCon = (body: any) => ({ json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
  mp.categoria.findUnique.mockResolvedValue({ id: 10 })
  mp.etiqueta.count.mockResolvedValue(0)
  mp.categoriaEtiquetaRegla.findMany.mockResolvedValue([])
  mp.$transaction.mockImplementation(async (ops: any[]) => ops)
})

describe('GET /api/categorias/[id]/etiquetas', () => {
  it('devuelve las reglas de la categoría en snake_case', async () => {
    mp.categoriaEtiquetaRegla.findMany.mockResolvedValue([
      { categoriaId: 10, etiquetaId: 3, modo: 'fijar' },
    ])
    const res = await GET({} as any, { params: { id: '10' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ categoria_id: 10, etiqueta_id: 3, modo: 'fijar' }])
    expect(mp.categoriaEtiquetaRegla.findMany).toHaveBeenCalledWith({
      where: { categoriaId: 10 },
      orderBy: { id: 'asc' },
      select: { categoriaId: true, etiquetaId: true, modo: true },
    })
  })

  it('400 con id inválido, sin tocar la DB', async () => {
    const res = await GET({} as any, { params: { id: 'abc' } })
    expect(res.status).toBe(400)
    expect(mp.categoriaEtiquetaRegla.findMany).not.toHaveBeenCalled()
  })
})

describe('PUT /api/categorias/[id]/etiquetas', () => {
  it('reemplaza las reglas: borra las de la categoría y crea las nuevas en una transacción', async () => {
    mp.etiqueta.count.mockResolvedValue(3)
    const res = await PUT(reqCon({ fijar: [1, 2], excluir: [5] }), { params: { id: '10' } })

    expect(res.status).toBe(200)
    expect(mp.categoriaEtiquetaRegla.deleteMany).toHaveBeenCalledWith({ where: { categoriaId: 10 } })
    expect(mp.categoriaEtiquetaRegla.createMany).toHaveBeenCalledWith({
      data: [
        { categoriaId: 10, etiquetaId: 1, modo: 'fijar' },
        { categoriaId: 10, etiquetaId: 2, modo: 'fijar' },
        { categoriaId: 10, etiquetaId: 5, modo: 'excluir' },
      ],
    })
    expect(mp.$transaction).toHaveBeenCalledTimes(1)
    expect(await res.json()).toEqual([
      { categoria_id: 10, etiqueta_id: 1, modo: 'fijar' },
      { categoria_id: 10, etiqueta_id: 2, modo: 'fijar' },
      { categoria_id: 10, etiqueta_id: 5, modo: 'excluir' },
    ])
  })

  it('con listas vacías borra las reglas y no crea ninguna', async () => {
    const res = await PUT(reqCon({ fijar: [], excluir: [] }), { params: { id: '10' } })
    expect(res.status).toBe(200)
    expect(mp.categoriaEtiquetaRegla.deleteMany).toHaveBeenCalledWith({ where: { categoriaId: 10 } })
    expect(mp.categoriaEtiquetaRegla.createMany).not.toHaveBeenCalled()
    expect(await res.json()).toEqual([])
  })

  it('no consulta las etiquetas si no hay ninguna en el body', async () => {
    await PUT(reqCon({}), { params: { id: '10' } })
    expect(mp.etiqueta.count).not.toHaveBeenCalled()
  })

  it('404 si la categoría no existe, sin borrar nada', async () => {
    mp.categoria.findUnique.mockResolvedValue(null)
    const res = await PUT(reqCon({ fijar: [1] }), { params: { id: '99' } })
    expect(res.status).toBe(404)
    expect(mp.$transaction).not.toHaveBeenCalled()
  })

  it('404 si alguna etiqueta no existe, sin borrar nada', async () => {
    mp.etiqueta.count.mockResolvedValue(1)
    const res = await PUT(reqCon({ fijar: [1, 2] }), { params: { id: '10' } })
    expect(res.status).toBe(404)
    expect(mp.etiqueta.count).toHaveBeenCalledWith({ where: { id: { in: [1, 2] } } })
    expect(mp.$transaction).not.toHaveBeenCalled()
  })

  it('400 si el body es inválido, sin tocar la DB', async () => {
    const res = await PUT(reqCon({ fijar: [4], excluir: [4] }), { params: { id: '10' } })
    expect(res.status).toBe(400)
    expect(mp.categoria.findUnique).not.toHaveBeenCalled()
    expect(mp.$transaction).not.toHaveBeenCalled()
  })

  it('400 con id inválido, sin leer el body', async () => {
    const json = vi.fn()
    const res = await PUT({ json } as any, { params: { id: '0' } })
    expect(res.status).toBe(400)
    expect(json).not.toHaveBeenCalled()
  })
})
