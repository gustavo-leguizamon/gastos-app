import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    cotizacionDivisa: { findMany: vi.fn(), upsert: vi.fn() },
  },
}))

import { GET, POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const row = { id: 3, monedaId: 2, fecha: '2026-01-10', valor: 1450, fuente: 'MEP' }

const get = (qs: string) => ({ url: `http://localhost/api/divisas/cotizaciones${qs}` }) as any
const post = (body: any) => ({ json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
  mp.cotizacionDivisa.findMany.mockResolvedValue([row])
  mp.cotizacionDivisa.upsert.mockResolvedValue(row)
})

describe('GET /api/divisas/cotizaciones', () => {
  it('filtra por moneda y devuelve el histórico en orden cronológico', async () => {
    await GET(get('?moneda_id=2'))
    const arg = mp.cotizacionDivisa.findMany.mock.calls[0][0]
    expect(arg.where).toEqual({ monedaId: 2 })
    expect(arg.orderBy).toEqual([{ fecha: 'asc' }])
  })

  it('mapea la respuesta a snake_case', async () => {
    const res = await GET(get('?moneda_id=2'))
    expect(await res.json()).toEqual([
      { id: 3, moneda_id: 2, fecha: '2026-01-10', valor: 1450, fuente: 'MEP' },
    ])
  })
})

describe('POST /api/divisas/cotizaciones', () => {
  it('upsertea sobre (moneda, fecha): recargar el mismo día corrige el valor', async () => {
    await POST(post({ moneda_id: 2, fecha: '2026-01-10', valor: 1450, fuente: 'MEP' }))
    expect(mp.cotizacionDivisa.upsert.mock.calls[0][0]).toEqual({
      where: { monedaId_fecha: { monedaId: 2, fecha: '2026-01-10' } },
      create: { monedaId: 2, fecha: '2026-01-10', valor: 1450, fuente: 'MEP' },
      update: { valor: 1450, fuente: 'MEP' },
    })
  })

  it('devuelve 201 con la cotización guardada', async () => {
    const res = await POST(post({ moneda_id: 2, fecha: '2026-01-10', valor: 1450 }))
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ id: 3, valor: 1450 })
  })

  it('devuelve 400 sin tocar la DB si el body es inválido', async () => {
    for (const body of [
      { moneda_id: 2, fecha: '2026-01-10', valor: 0 },
      { moneda_id: 2, fecha: 'ayer', valor: 1450 },
      { fecha: '2026-01-10', valor: 1450 },
    ]) {
      vi.clearAllMocks()
      const res = await POST(post(body))
      expect(res.status).toBe(400)
      expect(mp.cotizacionDivisa.upsert).not.toHaveBeenCalled()
    }
  })
})
