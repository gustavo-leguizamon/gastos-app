import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    ingreso: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

import { PUT, DELETE } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const row = {
  id: 1,
  fecha: '2026-08-05',
  mes: 8,
  anio: 2026,
  monedaId: 1,
  tipoCambio: 1,
  montoMoneda: 150000,
  moneda: { id: 1, codigo: 'ARS', simbolo: '$' },
  descripcion: 'Sueldo',
  casaId: null,
  casa: null,
  createdAt: new Date('2026-08-05T10:00:00Z'),
  updatedAt: new Date('2026-08-05T10:00:00Z'),
}

const req = (body: any) => ({ json: async () => body }) as any
const ctx = (id: string) => ({ params: { id } })

beforeEach(() => {
  vi.clearAllMocks()
  mp.ingreso.findUnique.mockResolvedValue(row)
  mp.ingreso.update.mockResolvedValue(row)
})

describe('PUT /api/ingresos/[id]', () => {
  it('actualiza mapeando el body a camelCase', async () => {
    await PUT(req({ fecha: '2026-08-06', monto_moneda: 200000, moneda_id: 1, descripcion: 'Bono' }), ctx('1'))
    expect(mp.ingreso.update.mock.calls[0][0]).toMatchObject({
      where: { id: 1 },
      data: {
        fecha: '2026-08-06',
        mes: 8,
        anio: 2026,
        monedaId: 1,
        tipoCambio: 1,
        montoMoneda: 200000,
        descripcion: 'Bono',
        casaId: null,
      },
    })
  })

  it('permite pasar el ingreso a otra moneda con su tipo de cambio', async () => {
    await PUT(req({ fecha: '2026-08-06', monto_moneda: 500, moneda_id: 2, tipo_cambio: 1400 }), ctx('1'))
    expect(mp.ingreso.update.mock.calls[0][0].data).toMatchObject({ monedaId: 2, montoMoneda: 500, tipoCambio: 1400 })
  })

  it('404 si el ingreso no existe, sin actualizar', async () => {
    mp.ingreso.findUnique.mockResolvedValue(null)
    const res = await PUT(req({ fecha: '2026-08-06', monto_moneda: 1, moneda_id: 1 }), ctx('99'))
    expect(res.status).toBe(404)
    expect(mp.ingreso.update).not.toHaveBeenCalled()
  })

  it('400 con body inválido, sin tocar la DB', async () => {
    const res = await PUT(req({ monto_moneda: 1, moneda_id: 1 }), ctx('1'))
    expect(res.status).toBe(400)
    expect(mp.ingreso.findUnique).not.toHaveBeenCalled()
    expect(mp.ingreso.update).not.toHaveBeenCalled()
  })

  it('400 con id inválido, sin tocar la DB', async () => {
    const res = await PUT(req({ fecha: '2026-08-06', monto_moneda: 1, moneda_id: 1 }), ctx('abc'))
    expect(res.status).toBe(400)
    expect(mp.ingreso.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/ingresos/[id]', () => {
  it('borra el ingreso existente', async () => {
    const res = await DELETE({} as any, ctx('1'))
    expect(mp.ingreso.delete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(await res.json()).toEqual({ ok: true })
  })

  it('404 si no existe, sin borrar', async () => {
    mp.ingreso.findUnique.mockResolvedValue(null)
    const res = await DELETE({} as any, ctx('99'))
    expect(res.status).toBe(404)
    expect(mp.ingreso.delete).not.toHaveBeenCalled()
  })

  it('400 con id inválido, sin borrar', async () => {
    const res = await DELETE({} as any, ctx('0'))
    expect(res.status).toBe(400)
    expect(mp.ingreso.delete).not.toHaveBeenCalled()
  })
})
