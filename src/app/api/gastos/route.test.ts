import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de Prisma: cada método usado por la route es un spy controlable por test.
vi.mock('@/lib/db', () => ({
  prisma: {
    gasto: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    concepto: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { GET, POST } from './route'
import { prisma } from '@/lib/db'

const mockPrisma = prisma as unknown as {
  gasto: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
  concepto: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
}

function rawGasto(overrides: Record<string, any> = {}) {
  return {
    id: 1, casaId: 10, conceptoId: 1, concepto: { id: 1, nombre: 'Internet' }, fechaVencimiento: '2026-06-10',
    tipoPago: 'D', monedaId: 2, tipoCambio: 1, totalMoneda: 1000,
    pasajeMesSiguiente: 0, prestamo_a_otro: 0, tarjetaId: null, categorias: [],
    cuotaActual: null, cuotasTotales: null, mes: 6, anio: 2026, notas: null,
    confirmado: true, esTarjeta: false,
    createdAt: new Date('2026-06-01T00:00:00Z'), updatedAt: new Date('2026-06-02T00:00:00Z'),
    pagos: [], items: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Por defecto resolveConcepto no encuentra y crea uno con id 50.
  mockPrisma.concepto.findFirst.mockResolvedValue(null)
  mockPrisma.concepto.create.mockResolvedValue({ id: 50 })
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
    mockPrisma.gasto.create.mockImplementation(async ({ data }: any) => rawGasto({ ...data, id: 99, categorias: [] }))

    const body = {
      casa_id: 5, descripcion: 'Luz', fecha_vencimiento: '2026-07-01', tipo_pago: 'C',
      moneda_id: 1, tipo_cambio: 2, total_moneda: 500, pasaje_mes_siguiente: 10,
      prestamo_a_otro: 20, tarjeta_id: 7, mes: 7, anio: 2026, confirmado: false,
      categoria_ids: [3, 8], es_tarjeta: false,
    }
    const res = await POST({ json: async () => body } as any)

    expect(res.status).toBe(201)
    // resolveConcepto('Luz') → no existe → crea id 50
    expect(mockPrisma.concepto.create).toHaveBeenCalledWith(expect.objectContaining({ data: { nombre: 'Luz' } }))
    expect(mockPrisma.gasto.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        casaId: 5, conceptoId: 50, tipoPago: 'C', monedaId: 1, tipoCambio: 2, totalMoneda: 500,
        pasajeMesSiguiente: 10, prestamo_a_otro: 20, tarjetaId: 7, mes: 7, anio: 2026,
        confirmado: false, esTarjeta: false,
      }),
    }))
    // descripcion ya no es columna: no debe ir en data
    expect(mockPrisma.gasto.create.mock.calls[0][0].data).not.toHaveProperty('descripcion')
    expect(mockPrisma.gasto.create.mock.calls[0][0].data.categorias).toEqual({ connect: [{ id: 3 }, { id: 8 }] })
  })

  it('usa concepto_id del body si viene, sin resolver por texto', async () => {
    mockPrisma.gasto.create.mockImplementation(async ({ data }: any) => rawGasto({ ...data, id: 101, categorias: [] }))
    await POST({ json: async () => ({ casa_id: 1, concepto_id: 7, total_moneda: 100, mes: 6, anio: 2026 }) } as any)
    expect(mockPrisma.concepto.findFirst).not.toHaveBeenCalled()
    expect(mockPrisma.concepto.create).not.toHaveBeenCalled()
    expect(mockPrisma.gasto.create.mock.calls[0][0].data.conceptoId).toBe(7)
  })

  it('aplica defaults cuando faltan campos opcionales', async () => {
    mockPrisma.gasto.create.mockImplementation(async ({ data }: any) => rawGasto({ ...data, id: 100, categorias: [] }))
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
