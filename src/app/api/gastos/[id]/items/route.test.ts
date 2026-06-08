import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    gastoItem: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { GET, POST } from './route'
import { prisma } from '@/lib/db'

const mockPrisma = prisma as unknown as {
  gastoItem: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
}

function rawItem(overrides: Record<string, any> = {}) {
  return {
    id: 1, gastoId: 3, descripcion: 'Nafta', monto: 250, fecha: '2026-06-03',
    cuotaActual: null, cuotasTotales: null, incluyeEnTotal: true, incluyeEnVencimiento: false,
    verificado: false, categoriaId: null, categoria: null,
    createdAt: new Date('2026-06-03T00:00:00Z'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/gastos/[id]/items', () => {
  it('filtra por gastoId y mapea a snake_case', async () => {
    mockPrisma.gastoItem.findMany.mockResolvedValue([rawItem({ categoria: { nombre: 'Auto' }, categoriaId: 9 })])
    const res = await GET({} as any, { params: { id: '3' } })
    const body = await res.json()
    expect(mockPrisma.gastoItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { gastoId: 3 } }))
    expect(body[0]).toMatchObject({ gasto_id: 3, categoria_id: 9, categoria_nombre: 'Auto', incluye_en_total: true })
  })
})

describe('POST /api/gastos/[id]/items', () => {
  it('mapea body y aplica defaults de los flags', async () => {
    mockPrisma.gastoItem.create.mockImplementation(async ({ data }: any) => rawItem({ ...data, id: 50 }))
    const res = await POST({ json: async () => ({ descripcion: 'Carne', monto: 100 }) } as any, { params: { id: '3' } })

    expect(res.status).toBe(201)
    const data = mockPrisma.gastoItem.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      gastoId: 3, descripcion: 'Carne', monto: 100, fecha: null,
      incluyeEnTotal: true, incluyeEnVencimiento: false, categoriaId: null,
    })
  })

  it('respeta los flags explícitos del body', async () => {
    mockPrisma.gastoItem.create.mockImplementation(async ({ data }: any) => rawItem({ ...data, id: 51 }))
    await POST({
      json: async () => ({ descripcion: 'TV', monto: 200, fecha: '2026-06-10', incluye_en_total: false, incluye_en_vencimiento: true, categoria_id: 4, cuota_actual: 1, cuotas_totales: 12 }),
    } as any, { params: { id: '3' } })

    const data = mockPrisma.gastoItem.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      fecha: '2026-06-10', incluyeEnTotal: false, incluyeEnVencimiento: true,
      categoriaId: 4, cuotaActual: 1, cuotasTotales: 12,
    })
  })
})
