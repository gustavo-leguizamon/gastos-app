import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    movimiento: { findMany: vi.fn(), create: vi.fn() },
  },
}))

import { GET, POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const row = {
  id: 7,
  inversionId: 3,
  fecha: '2026-08-26',
  montoActual: 1500,
  movimiento: 500,
  descripcion: 'aporte mensual',
  createdAt: new Date('2026-08-26T10:00:00Z'),
}

const post = (body: any) => ({ json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
  mp.movimiento.findMany.mockResolvedValue([row])
  mp.movimiento.create.mockImplementation(async ({ data }: any) => ({ ...row, ...data, id: 7 }))
})

describe('GET /api/inversiones/[id]/movimientos', () => {
  it('filtra por inversión y ordena cronológicamente (fecha asc, id asc)', async () => {
    await GET({} as any, { params: { id: '3' } })
    expect(mp.movimiento.findMany).toHaveBeenCalledWith({
      where: { inversionId: 3 },
      orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
    })
  })

  it('mapea a snake_case incluyendo la descripción', async () => {
    const res = await GET({} as any, { params: { id: '3' } })
    const json = await res.json()
    expect(json[0]).toEqual({
      id: 7,
      inversion_id: 3,
      fecha: '2026-08-26',
      monto_actual: 1500,
      movimiento: 500,
      descripcion: 'aporte mensual',
      created_at: '2026-08-26T10:00:00.000Z',
    })
  })

  it('un movimiento sin descripción sale en null', async () => {
    mp.movimiento.findMany.mockResolvedValue([{ ...row, descripcion: null }])
    const json = await (await GET({} as any, { params: { id: '3' } })).json()
    expect(json[0].descripcion).toBeNull()
  })
})

describe('POST /api/inversiones/[id]/movimientos', () => {
  it('guarda la descripción trimeada', async () => {
    const res = await POST(
      post({ fecha: '2026-08-26', monto_actual: 1500, movimiento: 500, descripcion: '  aporte mensual  ' }),
      { params: { id: '3' } },
    )
    expect(mp.movimiento.create).toHaveBeenCalledWith({
      data: {
        inversionId: 3,
        fecha: '2026-08-26',
        montoActual: 1500,
        movimiento: 500,
        descripcion: 'aporte mensual',
      },
    })
    expect(res.status).toBe(201)
  })

  it('sin descripción (o vacía) persiste null, no ""', async () => {
    await POST(post({ fecha: '2026-08-26', monto_actual: 1500 }), { params: { id: '3' } })
    expect(mp.movimiento.create.mock.calls[0][0].data).toMatchObject({ movimiento: 0, descripcion: null })

    await POST(post({ fecha: '2026-08-26', monto_actual: 1500, descripcion: '   ' }), { params: { id: '3' } })
    expect(mp.movimiento.create.mock.calls[1][0].data.descripcion).toBeNull()
  })
})
