import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    gasto: { findMany: vi.fn() },
  },
}))

import { GET } from './route'
import { prisma } from '@/lib/db'

const mockPrisma = prisma as unknown as {
  gasto: { findMany: ReturnType<typeof vi.fn> }
}

function rawGasto(overrides: Record<string, any> = {}) {
  return {
    conceptoId: 1,
    concepto: { id: 1, nombre: 'Internet' },
    totalMoneda: 1000,
    tipoCambio: 1,
    confirmado: true,
    categoriaId: null,
    categoria: null,
    etiquetas: [],
    items: [],
    mes: 6,
    anio: 2026,
    ...overrides,
  }
}

function url(qs: string) {
  return { url: `http://localhost/api/reportes?${qs}` } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.gasto.findMany.mockResolvedValue([])
})

describe('GET /api/reportes', () => {
  it('400 si falta algún parámetro de rango', async () => {
    const res = await GET(url('mes_desde=5&anio_desde=2026'))
    expect(res.status).toBe(400)
  })

  it('arma el where con OR de meses y excluye esTarjeta por defecto', async () => {
    await GET(url('mes_desde=5&anio_desde=2026&mes_hasta=7&anio_hasta=2026'))
    const arg = mockPrisma.gasto.findMany.mock.calls[0][0]
    expect(arg.where.esTarjeta).toBe(false)
    expect(arg.where.OR).toEqual([
      { mes: 5, anio: 2026 },
      { mes: 6, anio: 2026 },
      { mes: 7, anio: 2026 },
    ])
    expect(arg.include).toMatchObject({ categoria: true, etiquetas: true, concepto: true, items: true, tarjeta: true })
  })

  it('mapea filtros snake_case → camelCase (casa, tipo pago, categoría única, etiquetas, tarjetas, conceptos)', async () => {
    await GET(url('mes_desde=6&anio_desde=2026&mes_hasta=6&anio_hasta=2026&casa_id=3&tipo_pago=C&categoria_ids=1,2&etiqueta_ids=8&tarjeta_ids=9&concepto_ids=4,5'))
    const where = mockPrisma.gasto.findMany.mock.calls[0][0].where
    expect(where.casaId).toBe(3)
    expect(where.tipoPago).toBe('C')
    expect(where.categoriaId).toEqual({ in: [1, 2] })
    expect(where.etiquetas).toEqual({ some: { id: { in: [8] } } })
    expect(where.tarjetaId).toEqual({ in: [9] })
    expect(where.conceptoId).toEqual({ in: [4, 5] })
  })

  it('agrupar=subitem incluye las categorías/concepto de los items y desglosa por sub-item', async () => {
    mockPrisma.gasto.findMany.mockResolvedValue([
      rawGasto({
        mes: 6,
        totalMoneda: 9999,
        items: [
          { monto: 70, incluyeEnTotal: true, conceptoId: 11, concepto: { id: 11, nombre: 'Comida' }, categoriaId: 1, categoria: { id: 1, nombre: 'Super' }, etiquetas: [] },
          { monto: 30, incluyeEnTotal: true, conceptoId: 12, concepto: { id: 12, nombre: 'Limpieza' }, categoriaId: 2, categoria: { id: 2, nombre: 'Hogar' }, etiquetas: [] },
        ],
      }),
    ])
    const res = await GET(url('mes_desde=6&anio_desde=2026&mes_hasta=6&anio_hasta=2026&agrupar=subitem'))
    const body = await res.json()
    const items = mockPrisma.gasto.findMany.mock.calls[0][0].include.items
    expect(items).toMatchObject({ include: { categoria: true, etiquetas: true, concepto: true } })
    expect(body.kpis.total).toBe(100)
    expect(body.por_categoria.find((c: any) => c.id === 1)?.total_ars).toBe(70)
    expect(body.por_categoria.find((c: any) => c.id === 2)?.total_ars).toBe(30)
  })

  it('agrupar=subitem pre-filtra por gasto O sub-ítem en las dimensiones de categorización', async () => {
    await GET(url('mes_desde=6&anio_desde=2026&mes_hasta=6&anio_hasta=2026&agrupar=subitem&categoria_ids=9&etiqueta_ids=4&concepto_ids=7&tarjeta_ids=3'))
    const where = mockPrisma.gasto.findMany.mock.calls[0][0].where
    // tarjeta sigue siendo nivel gasto
    expect(where.tarjetaId).toEqual({ in: [3] })
    // categorización: OR gasto/sub-ítem, ANDeadas entre sí
    expect(where).not.toHaveProperty('categoriaId')
    expect(where.AND).toEqual([
      { OR: [
        { categoriaId: { in: [9] } },
        { items: { some: { incluyeEnTotal: true, categoriaId: { in: [9] } } } },
      ] },
      { OR: [
        { etiquetas: { some: { id: { in: [4] } } } },
        { items: { some: { incluyeEnTotal: true, etiquetas: { some: { id: { in: [4] } } } } } },
      ] },
      { OR: [
        { conceptoId: { in: [7] } },
        { items: { some: { incluyeEnTotal: true, conceptoId: { in: [7] } } } },
      ] },
    ])
  })

  it('agrupar=subitem filtra los sub-ítems por etiqueta aunque el gasto padre no la tenga', async () => {
    mockPrisma.gasto.findMany.mockResolvedValue([
      rawGasto({
        esTarjeta: true,
        categoriaId: 9,
        categoria: { id: 9, nombre: 'Tarjeta crédito' },
        items: [
          { monto: 700, incluyeEnTotal: true, conceptoId: 11, concepto: { id: 11, nombre: 'ABL' }, categoriaId: 1, categoria: { id: 1, nombre: 'Servicios' }, etiquetas: [{ id: 4, nombre: 'Impuesto' }] },
          { monto: 300, incluyeEnTotal: true, conceptoId: 12, concepto: { id: 12, nombre: 'Super' }, categoriaId: 2, categoria: { id: 2, nombre: 'Comida' }, etiquetas: [] },
        ],
      }),
    ])
    const res = await GET(url('mes_desde=6&anio_desde=2026&mes_hasta=6&anio_hasta=2026&agrupar=subitem&incluir_tarjetas=true&categoria_ids=9&etiqueta_ids=4'))
    const body = await res.json()
    expect(body.kpis.total).toBe(700)
    expect(body.por_etiqueta).toEqual([{ id: 4, nombre: 'Impuesto', total_ars: 700 }])
  })

  it('incluir_tarjetas=true no fuerza esTarjeta=false', async () => {
    await GET(url('mes_desde=6&anio_desde=2026&mes_hasta=6&anio_hasta=2026&incluir_tarjetas=true'))
    const where = mockPrisma.gasto.findMany.mock.calls[0][0].where
    expect(where).not.toHaveProperty('esTarjeta')
  })

  it('devuelve el reporte agregado', async () => {
    mockPrisma.gasto.findMany.mockResolvedValue([
      rawGasto({ mes: 6, totalMoneda: 100, tipoPago: 'C', tarjetaId: 1, tarjeta: { id: 1, nombre: 'Visa' }, categoriaId: 1, categoria: { id: 1, nombre: 'Auto' } }),
      rawGasto({ mes: 6, totalMoneda: 200, tipoPago: 'D', conceptoId: 2, concepto: { id: 2, nombre: 'Luz' } }),
    ])
    const res = await GET(url('mes_desde=6&anio_desde=2026&mes_hasta=6&anio_hasta=2026'))
    const body = await res.json()
    expect(body.kpis.total).toBe(300)
    expect(body.kpis.cantidad_gastos).toBe(2)
    expect(body.por_categoria.find((c: any) => c.id === 1)?.total_ars).toBe(100)
    expect(body.top_conceptos).toHaveLength(2)
    expect(body.por_tarjeta.find((t: any) => t.id === 1)?.total_ars).toBe(100)
    expect(body.por_tipo_pago).toEqual(expect.arrayContaining([
      { tipo: 'C', nombre: 'Crédito', total_ars: 100 },
      { tipo: 'D', nombre: 'Débito', total_ars: 200 },
    ]))
  })
})
