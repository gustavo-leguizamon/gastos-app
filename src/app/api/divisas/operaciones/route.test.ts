import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    operacionDivisa: { findMany: vi.fn(), create: vi.fn() },
  },
}))

import { GET, POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const row = {
  id: 1,
  fecha: '2026-01-10',
  tipo: 'compra',
  monedaId: 2,
  moneda: { id: 2, codigo: 'USD', simbolo: 'US$' },
  cantidad: 100,
  cotizacion: 1000,
  comision: 5000,
  comisionMoneda: 'ARS',
  plataforma: 'Broker X',
  descripcion: null,
  createdAt: new Date('2026-01-10T12:00:00Z'),
  updatedAt: new Date('2026-01-10T12:00:00Z'),
}

const get = (qs: string) => ({ url: `http://localhost/api/divisas/operaciones${qs}` }) as any
const post = (body: any) => ({ json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
  mp.operacionDivisa.findMany.mockResolvedValue([row])
  mp.operacionDivisa.create.mockResolvedValue(row)
})

describe('GET /api/divisas/operaciones', () => {
  it('filtra por moneda', async () => {
    await GET(get('?moneda_id=2'))
    expect(mp.operacionDivisa.findMany.mock.calls[0][0].where).toEqual({ monedaId: 2 })
  })

  it('sin moneda no filtra nada', async () => {
    await GET(get(''))
    expect(mp.operacionDivisa.findMany.mock.calls[0][0].where).toEqual({})
  })

  it('devuelve las operaciones en orden cronológico ascendente, que es el que espera la corrida', async () => {
    await GET(get('?moneda_id=2'))
    expect(mp.operacionDivisa.findMany.mock.calls[0][0].orderBy).toEqual([{ fecha: 'asc' }, { id: 'asc' }])
  })

  it('trae la moneda para poder mostrar el símbolo', async () => {
    await GET(get('?moneda_id=2'))
    expect(mp.operacionDivisa.findMany.mock.calls[0][0].include).toEqual({ moneda: true })
  })

  it('mapea la respuesta a snake_case', async () => {
    const res = await GET(get('?moneda_id=2'))
    expect(await res.json()).toEqual([
      {
        id: 1,
        fecha: '2026-01-10',
        tipo: 'compra',
        moneda_id: 2,
        moneda_codigo: 'USD',
        moneda_simbolo: 'US$',
        cantidad: 100,
        cotizacion: 1000,
        comision: 5000,
        comision_moneda: 'ARS',
        plataforma: 'Broker X',
        descripcion: null,
        created_at: '2026-01-10T12:00:00.000Z',
        updated_at: '2026-01-10T12:00:00.000Z',
      },
    ])
  })
})

describe('POST /api/divisas/operaciones', () => {
  it('mapea el body a camelCase', async () => {
    await POST(
      post({
        fecha: '2026-01-10',
        tipo: 'compra',
        moneda_id: 2,
        cantidad: 100,
        cotizacion: 1000,
        comision: 5000,
        comision_moneda: 'ARS',
        plataforma: 'Broker X',
      }),
    )
    expect(mp.operacionDivisa.create.mock.calls[0][0].data).toEqual({
      fecha: '2026-01-10',
      tipo: 'compra',
      monedaId: 2,
      cantidad: 100,
      cotizacion: 1000,
      comision: 5000,
      comisionMoneda: 'ARS',
      plataforma: 'Broker X',
      descripcion: null,
    })
  })

  it('guarda la comisión cobrada en divisa', async () => {
    await POST(
      post({
        fecha: '2026-01-10',
        tipo: 'venta',
        moneda_id: 2,
        cantidad: 50,
        cotizacion: 1500,
        comision: 0.5,
        comision_moneda: 'DIVISA',
      }),
    )
    expect(mp.operacionDivisa.create.mock.calls[0][0].data).toMatchObject({
      comision: 0.5,
      comisionMoneda: 'DIVISA',
    })
  })

  it('acepta un rendimiento sin cotización', async () => {
    await POST(post({ fecha: '2026-01-10', tipo: 'rendimiento', moneda_id: 2, cantidad: 10 }))
    expect(mp.operacionDivisa.create.mock.calls[0][0].data).toMatchObject({
      tipo: 'rendimiento',
      cotizacion: null,
    })
  })

  it('devuelve 201 con la operación creada', async () => {
    const res = await POST(post({ fecha: '2026-01-10', tipo: 'compra', moneda_id: 2, cantidad: 100, cotizacion: 1000 }))
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ id: 1, tipo: 'compra', cantidad: 100 })
  })

  it('devuelve 400 sin tocar la DB si el body es inválido', async () => {
    const invalidos = [
      { tipo: 'compra', moneda_id: 2, cantidad: 100, cotizacion: 1000 }, // sin fecha
      { fecha: '2026-01-10', tipo: 'compra', moneda_id: 2, cantidad: 100 }, // compra sin cotización
      { fecha: '2026-01-10', tipo: 'compra', moneda_id: 2, cantidad: -100, cotizacion: 1000 },
      { fecha: '2026-01-10', tipo: 'permuta', moneda_id: 2, cantidad: 100, cotizacion: 1000 },
    ]
    for (const body of invalidos) {
      vi.clearAllMocks()
      const res = await POST(post(body))
      expect(res.status).toBe(400)
      expect(mp.operacionDivisa.create).not.toHaveBeenCalled()
    }
  })
})
