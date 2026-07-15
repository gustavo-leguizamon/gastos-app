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
    categorias: [],
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
    expect(arg.include).toMatchObject({ categorias: true, concepto: true, items: true, tarjeta: true })
  })

  it('mapea filtros snake_case → camelCase (casa, tipo pago, categorías, tarjetas, conceptos)', async () => {
    await GET(url('mes_desde=6&anio_desde=2026&mes_hasta=6&anio_hasta=2026&casa_id=3&tipo_pago=C&categoria_ids=1,2&tarjeta_ids=9&concepto_ids=4,5'))
    const where = mockPrisma.gasto.findMany.mock.calls[0][0].where
    expect(where.casaId).toBe(3)
    expect(where.tipoPago).toBe('C')
    expect(where.categorias).toEqual({ some: { id: { in: [1, 2] } } })
    expect(where.tarjetaId).toEqual({ in: [9] })
    expect(where.conceptoId).toEqual({ in: [4, 5] })
  })

  it('agrupar=subitem incluye las categorías/concepto de los items y desglosa por sub-item', async () => {
    mockPrisma.gasto.findMany.mockResolvedValue([
      rawGasto({
        mes: 6,
        totalMoneda: 9999,
        items: [
          { monto: 70, incluyeEnTotal: true, conceptoId: 11, concepto: { id: 11, nombre: 'Comida' }, categorias: [{ id: 1, nombre: 'Super' }] },
          { monto: 30, incluyeEnTotal: true, conceptoId: 12, concepto: { id: 12, nombre: 'Limpieza' }, categorias: [{ id: 2, nombre: 'Hogar' }] },
        ],
      }),
    ])
    const res = await GET(url('mes_desde=6&anio_desde=2026&mes_hasta=6&anio_hasta=2026&agrupar=subitem'))
    const body = await res.json()
    const items = mockPrisma.gasto.findMany.mock.calls[0][0].include.items
    expect(items).toMatchObject({ include: { categorias: true, concepto: true } })
    expect(body.kpis.total).toBe(100)
    expect(body.por_categoria.find((c: any) => c.id === 1)?.total_ars).toBe(70)
    expect(body.por_categoria.find((c: any) => c.id === 2)?.total_ars).toBe(30)
  })

  it('incluir_tarjetas=true no fuerza esTarjeta=false', async () => {
    await GET(url('mes_desde=6&anio_desde=2026&mes_hasta=6&anio_hasta=2026&incluir_tarjetas=true'))
    const where = mockPrisma.gasto.findMany.mock.calls[0][0].where
    expect(where).not.toHaveProperty('esTarjeta')
  })

  it('devuelve el reporte agregado', async () => {
    mockPrisma.gasto.findMany.mockResolvedValue([
      rawGasto({ mes: 6, totalMoneda: 100, tipoPago: 'C', tarjetaId: 1, tarjeta: { id: 1, nombre: 'Visa' }, categorias: [{ id: 1, nombre: 'Auto' }] }),
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
