import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: { articulo: { findMany: vi.fn() } },
}))

import { GET } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/api/lista-compras/articulos', () => {
  it('GET devuelve el catálogo con el último precio y la última cantidad', async () => {
    mp.articulo.findMany.mockResolvedValue([
      {
        id: 1, nombre: 'Azúcar', unidadId: 2, unidad: { nombre: 'kg' }, rubroId: 3, rubro: { nombre: 'Almacén' },
        // De la línea más nueva a la más vieja: la última no tiene precio, el último precio es de la anterior.
        items: [{ cantidad: 3, precioUnitario: null }, { cantidad: 2, precioUnitario: 1500 }],
      },
      { id: 2, nombre: 'Yerba', unidadId: 1, unidad: { nombre: 'un' }, rubroId: null, rubro: null, items: [] },
    ])
    const res = await GET()
    expect(mp.articulo.findMany.mock.calls[0][0].include.items.orderBy).toEqual([{ anio: 'desc' }, { mes: 'desc' }])
    expect(await res.json()).toEqual([
      { id: 1, nombre: 'Azúcar', unidad_id: 2, unidad: 'kg', rubro_id: 3, rubro: 'Almacén', ultimo_precio: 1500, ultima_cantidad: 3 },
      { id: 2, nombre: 'Yerba', unidad_id: 1, unidad: 'un', rubro_id: null, rubro: null, ultimo_precio: null, ultima_cantidad: null },
    ])
  })
})
