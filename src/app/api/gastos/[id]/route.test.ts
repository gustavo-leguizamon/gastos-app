import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    gasto: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    gastoItem: {
      updateMany: vi.fn(),
    },
    concepto: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { GET, PUT, DELETE } from './route'
import { prisma } from '@/lib/db'

const mockPrisma = prisma as unknown as {
  gasto: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }
  gastoItem: { updateMany: ReturnType<typeof vi.fn> }
  concepto: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
}

function rawGasto(overrides: Record<string, any> = {}) {
  return {
    id: 1, casaId: 10, conceptoId: 1, concepto: { id: 1, nombre: 'Internet' }, fechaVencimiento: '2026-06-10',
    tipoPago: 'D', monedaId: 2, tipoCambio: 1, totalMoneda: 1000,
    pasajeMesSiguiente: 0, prestamo_a_otro: 0, tarjetaId: null, etiquetas: [],
    cuotaActual: null, cuotasTotales: null, mes: 6, anio: 2026, notas: null,
    confirmado: true, esTarjeta: false,
    createdAt: new Date('2026-06-01T00:00:00Z'), updatedAt: new Date('2026-06-02T00:00:00Z'),
    pagos: [], items: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.concepto.findFirst.mockResolvedValue(null)
  mockPrisma.concepto.create.mockResolvedValue({ id: 50 })
})

describe('GET /api/gastos/[id]', () => {
  it('devuelve 404 cuando no existe', async () => {
    mockPrisma.gasto.findUnique.mockResolvedValue(null)
    const res = await GET({} as any, { params: { id: '99' } })
    expect(res.status).toBe(404)
  })

  it('devuelve el gasto mapeado cuando existe', async () => {
    mockPrisma.gasto.findUnique.mockResolvedValue(rawGasto({ id: 42 }))
    const res = await GET({} as any, { params: { id: '42' } })
    const body = await res.json()
    expect(mockPrisma.gasto.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 42 } }))
    expect(body).toMatchObject({ id: 42, casa_id: 10, total_ars: 1000 })
  })
})

describe('PUT /api/gastos/[id]', () => {
  it('resuelve el concepto, mapea data camelCase y propaga el conceptoId a items propagados', async () => {
    mockPrisma.gasto.update.mockResolvedValue(rawGasto({ id: 5, conceptoId: 50, concepto: { id: 50, nombre: 'Nuevo nombre' } }))
    mockPrisma.gastoItem.updateMany.mockResolvedValue({ count: 2 })

    const body = {
      casa_id: 1, descripcion: 'Nuevo nombre', fecha_vencimiento: '2026-06-15', tipo_pago: 'D',
      moneda_id: 2, total_moneda: 1200, mes: 6, anio: 2026,
    }
    const res = await PUT({ json: async () => body } as any, { params: { id: '5' } })

    expect(mockPrisma.concepto.create).toHaveBeenCalledWith(expect.objectContaining({ data: { nombre: 'Nuevo nombre' } }))
    expect(mockPrisma.gasto.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 5 },
      data: expect.objectContaining({ conceptoId: 50, totalMoneda: 1200, casaId: 1 }),
    }))
    expect(mockPrisma.gasto.update.mock.calls[0][0].data).not.toHaveProperty('descripcion')
    // Propaga el concepto a los sub-items propagados de tarjeta
    expect(mockPrisma.gastoItem.updateMany).toHaveBeenCalledWith({
      where: { pago: { gastoId: 5 } },
      data: { conceptoId: 50 },
    })
    expect((await res.json()).descripcion).toBe('Nuevo nombre')
  })

  it('no rompe el flujo si la propagación de items falla', async () => {
    mockPrisma.gasto.update.mockResolvedValue(rawGasto({ id: 5 }))
    mockPrisma.gastoItem.updateMany.mockRejectedValue(new Error('db down'))
    const res = await PUT({ json: async () => ({ descripcion: 'X', mes: 6, anio: 2026 }) } as any, { params: { id: '5' } })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/gastos/[id]', () => {
  it('elimina por id y responde ok', async () => {
    mockPrisma.gasto.delete.mockResolvedValue(rawGasto())
    const res = await DELETE({} as any, { params: { id: '7' } })
    expect(mockPrisma.gasto.delete).toHaveBeenCalledWith({ where: { id: 7 } })
    expect(await res.json()).toEqual({ ok: true })
  })
})
