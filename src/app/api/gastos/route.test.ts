import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de Prisma: cada método usado por la route es un spy controlable por test.
vi.mock('@/lib/db', () => ({
  prisma: {
    gasto: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { GET, POST } from './route'
import { prisma } from '@/lib/db'

const mockPrisma = prisma as unknown as {
  gasto: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
}

function rawGasto(overrides: Record<string, any> = {}) {
  return {
    id: 1, casaId: 10, descripcion: 'Internet', fechaVencimiento: '2026-06-10',
    tipoPago: 'D', monedaId: 2, tipoCambio: 1, totalMoneda: 1000,
    pasajeMesSiguiente: 0, prestamo_a_otro: 0, tarjetaId: null, categoriaId: null,
    cuotaActual: null, cuotasTotales: null, mes: 6, anio: 2026, notas: null,
    confirmado: true, esTarjeta: false,
    createdAt: new Date('2026-06-01T00:00:00Z'), updatedAt: new Date('2026-06-02T00:00:00Z'),
    pagos: [], items: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/gastos', () => {
  it('arma el where con los filtros snake_case → camelCase y devuelve la respuesta mapeada', async () => {
    mockPrisma.gasto.findMany.mockResolvedValue([rawGasto()])

    const res = await GET({ url: 'http://localhost/api/gastos?mes=6&anio=2026&casa_id=3&tipo_pago=C' } as any)
    const body = await res.json()

    expect(mockPrisma.gasto.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { mes: 6, anio: 2026, casaId: 3, tipoPago: 'C' },
    }))
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({ id: 1, casa_id: 10, tipo_pago: 'D', total_ars: 1000 })
  })

  it('where vacío cuando no hay query params', async () => {
    mockPrisma.gasto.findMany.mockResolvedValue([])
    await GET({ url: 'http://localhost/api/gastos' } as any)
    expect(mockPrisma.gasto.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
  })
})

describe('POST /api/gastos', () => {
  it('mapea el body snake_case → data camelCase y responde 201', async () => {
    mockPrisma.gasto.create.mockImplementation(async ({ data }: any) => rawGasto({ ...data, id: 99 }))

    const body = {
      casa_id: 5, descripcion: 'Luz', fecha_vencimiento: '2026-07-01', tipo_pago: 'C',
      moneda_id: 1, tipo_cambio: 2, total_moneda: 500, pasaje_mes_siguiente: 10,
      prestamo_a_otro: 20, tarjeta_id: 7, mes: 7, anio: 2026, confirmado: false,
      categoria_id: 3, es_tarjeta: false,
    }
    const res = await POST({ json: async () => body } as any)

    expect(res.status).toBe(201)
    expect(mockPrisma.gasto.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        casaId: 5, tipoPago: 'C', monedaId: 1, tipoCambio: 2, totalMoneda: 500,
        pasajeMesSiguiente: 10, prestamo_a_otro: 20, tarjetaId: 7, mes: 7, anio: 2026,
        confirmado: false, categoriaId: 3, esTarjeta: false,
      }),
    }))
  })

  it('aplica defaults cuando faltan campos opcionales', async () => {
    mockPrisma.gasto.create.mockImplementation(async ({ data }: any) => rawGasto({ ...data, id: 100 }))
    await POST({ json: async () => ({ casa_id: 1, descripcion: 'X', total_moneda: 100, mes: 6, anio: 2026 }) } as any)

    const data = mockPrisma.gasto.create.mock.calls[0][0].data
    expect(data.tipoCambio).toBe(1)
    expect(data.totalPagado).toBe(0)
    expect(data.pasajeMesSiguiente).toBe(0)
    expect(data.prestamo_a_otro).toBe(0)
    expect(data.tarjetaId).toBeNull()
    expect(data.confirmado).toBe(true)
    expect(data.esTarjeta).toBe(false)
  })
})
