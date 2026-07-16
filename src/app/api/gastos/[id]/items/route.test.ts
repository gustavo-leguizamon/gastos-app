import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    gastoItem: {
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
  gastoItem: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
  concepto: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
}

function rawItem(overrides: Record<string, any> = {}) {
  return {
    id: 1, gastoId: 3, conceptoId: 1, concepto: { id: 1, nombre: 'Nafta' }, monto: 250, fecha: '2026-06-03',
    cuotaActual: null, cuotasTotales: null, incluyeEnTotal: true, incluyeEnVencimiento: false,
    verificado: false, etiquetas: [],
    createdAt: new Date('2026-06-03T00:00:00Z'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.concepto.findFirst.mockResolvedValue(null)
  mockPrisma.concepto.create.mockResolvedValue({ id: 50 })
})

describe('GET /api/gastos/[id]/items', () => {
  it('filtra por gastoId y mapea a snake_case', async () => {
    mockPrisma.gastoItem.findMany.mockResolvedValue([rawItem({ etiquetas: [{ id: 9, nombre: 'Auto' }] })])
    const res = await GET({} as any, { params: { id: '3' } })
    const body = await res.json()
    expect(mockPrisma.gastoItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { gastoId: 3 } }))
    expect(body[0]).toMatchObject({ gasto_id: 3, etiqueta_ids: [9], incluye_en_total: true })
    expect(body[0].etiquetas).toEqual([{ id: 9, nombre: 'Auto' }])
  })
})

describe('POST /api/gastos/[id]/items', () => {
  it('mapea body y aplica defaults de los flags', async () => {
    mockPrisma.gastoItem.create.mockImplementation(async ({ data }: any) => rawItem({ ...data, id: 50, etiquetas: [] }))
    const res = await POST({ json: async () => ({ descripcion: 'Carne', monto: 100 }) } as any, { params: { id: '3' } })

    expect(res.status).toBe(201)
    expect(mockPrisma.concepto.create).toHaveBeenCalledWith(expect.objectContaining({ data: { nombre: 'Carne' } }))
    const data = mockPrisma.gastoItem.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      gastoId: 3, conceptoId: 50, monto: 100, fecha: null,
      incluyeEnTotal: true, incluyeEnVencimiento: false,
    })
    expect(data).not.toHaveProperty('descripcion')
    expect(data.etiquetas).toEqual({ connect: [] })
  })

  it('respeta los flags explícitos del body y conecta categorías', async () => {
    mockPrisma.gastoItem.create.mockImplementation(async ({ data }: any) => rawItem({ ...data, id: 51, etiquetas: [] }))
    await POST({
      json: async () => ({ descripcion: 'TV', monto: 200, fecha: '2026-06-10', incluye_en_total: false, incluye_en_vencimiento: true, etiqueta_ids: [4, 7], cuota_actual: 1, cuotas_totales: 12 }),
    } as any, { params: { id: '3' } })

    const data = mockPrisma.gastoItem.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      fecha: '2026-06-10', incluyeEnTotal: false, incluyeEnVencimiento: true,
      cuotaActual: 1, cuotasTotales: 12,
    })
    expect(data.etiquetas).toEqual({ connect: [{ id: 4 }, { id: 7 }] })
  })
})
