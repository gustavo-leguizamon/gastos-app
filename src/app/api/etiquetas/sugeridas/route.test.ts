import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    gasto: { findMany: vi.fn() },
    gastoItem: { findMany: vi.fn() },
    categoriaEtiquetaRegla: { findMany: vi.fn() },
  },
}))

import { GET } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

beforeEach(() => {
  vi.clearAllMocks()
  mp.gasto.findMany.mockResolvedValue([])
  mp.gastoItem.findMany.mockResolvedValue([])
  mp.categoriaEtiquetaRegla.findMany.mockResolvedValue([])
})

describe('GET /api/etiquetas/sugeridas', () => {
  it('excluye los gastos de resumen de tarjeta y pide sólo categoría + etiquetas', async () => {
    await GET()
    expect(mp.gasto.findMany).toHaveBeenCalledWith({
      where: { esTarjeta: false },
      select: { categoriaId: true, etiquetas: { select: { id: true } } },
    })
    expect(mp.gastoItem.findMany).toHaveBeenCalledWith({
      select: { categoriaId: true, etiquetas: { select: { id: true } } },
    })
  })

  it('agrega los usos de gastos y de sub-items en el mismo mapa', async () => {
    mp.gasto.findMany.mockResolvedValue([
      { categoriaId: 10, etiquetas: [{ id: 1 }, { id: 2 }] },
    ])
    mp.gastoItem.findMany.mockResolvedValue([
      { categoriaId: 20, etiquetas: [{ id: 2 }] },
    ])
    const data = await (await GET()).json()
    expect(data.por_categoria).toEqual({ '10': [1, 2], '20': [2] })
  })

  it('marca transversal a la etiqueta que cruza 3 categorías', async () => {
    mp.gasto.findMany.mockResolvedValue([
      { categoriaId: 10, etiquetas: [{ id: 5 }] },
      { categoriaId: 20, etiquetas: [{ id: 5 }] },
    ])
    mp.gastoItem.findMany.mockResolvedValue([
      { categoriaId: 30, etiquetas: [{ id: 5 }] },
    ])
    const data = await (await GET()).json()
    expect(data.transversales).toEqual([5])
  })

  it('los gastos sin categoría no ensucian el mapa', async () => {
    mp.gasto.findMany.mockResolvedValue([
      { categoriaId: null, etiquetas: [{ id: 1 }] },
      { categoriaId: 10, etiquetas: [{ id: 1 }] },
    ])
    const data = await (await GET()).json()
    expect(data).toEqual({ transversales: [], por_categoria: { '10': [1] }, reglas: [] })
  })

  it('sin datos devuelve el payload vacío', async () => {
    const data = await (await GET()).json()
    expect(data).toEqual({ transversales: [], por_categoria: {}, reglas: [] })
  })

  it('mapea las reglas manuales a snake_case', async () => {
    mp.categoriaEtiquetaRegla.findMany.mockResolvedValue([
      { categoriaId: 10, etiquetaId: 77, modo: 'fijar' },
      { categoriaId: 10, etiquetaId: 5, modo: 'excluir' },
    ])
    const data = await (await GET()).json()
    expect(data.reglas).toEqual([
      { categoria_id: 10, etiqueta_id: 77, modo: 'fijar' },
      { categoria_id: 10, etiqueta_id: 5, modo: 'excluir' },
    ])
    expect(mp.categoriaEtiquetaRegla.findMany).toHaveBeenCalledWith({
      orderBy: { id: 'asc' },
      select: { categoriaId: true, etiquetaId: true, modo: true },
    })
  })
})
