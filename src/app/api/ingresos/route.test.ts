import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    ingreso: { findMany: vi.fn(), create: vi.fn() },
  },
}))

import { GET, POST } from './route'
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
  casaId: 2,
  casa: { id: 2, nombre: 'Casa' },
  createdAt: new Date('2026-08-05T10:00:00Z'),
  updatedAt: new Date('2026-08-05T10:00:00Z'),
}

const get = (qs: string) => ({ url: `http://localhost/api/ingresos${qs}` }) as any
const post = (body: any) => ({ json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
  mp.ingreso.findMany.mockResolvedValue([row])
  mp.ingreso.create.mockResolvedValue(row)
})

describe('GET /api/ingresos', () => {
  it('filtra por mes y año y ordena por fecha descendente', async () => {
    await GET(get('?mes=8&anio=2026'))
    const arg = mp.ingreso.findMany.mock.calls[0][0]
    expect(arg.where).toEqual({ mes: 8, anio: 2026 })
    expect(arg.orderBy).toEqual([{ fecha: 'desc' }, { id: 'desc' }])
  })

  it('al filtrar por casa incluye los ingresos sin casa', async () => {
    await GET(get('?mes=8&anio=2026&casa_id=2'))
    expect(mp.ingreso.findMany.mock.calls[0][0].where).toEqual({
      mes: 8,
      anio: 2026,
      OR: [{ casaId: 2 }, { casaId: null }],
    })
  })

  it('mapea la respuesta a snake_case incluyendo moneda y monto en ARS', async () => {
    const res = await GET(get('?mes=8&anio=2026'))
    expect(await res.json()).toEqual([
      {
        id: 1,
        fecha: '2026-08-05',
        mes: 8,
        anio: 2026,
        moneda_id: 1,
        moneda_codigo: 'ARS',
        moneda_simbolo: '$',
        tipo_cambio: 1,
        monto_moneda: 150000,
        monto_ars: 150000,
        descripcion: 'Sueldo',
        casa_id: 2,
        casa_nombre: 'Casa',
        created_at: '2026-08-05T10:00:00.000Z',
        updated_at: '2026-08-05T10:00:00.000Z',
      },
    ])
  })

  it('trae la moneda para poder mostrar el monto original', async () => {
    await GET(get('?mes=8&anio=2026'))
    expect(mp.ingreso.findMany.mock.calls[0][0].include).toEqual({ casa: true, moneda: true })
  })
})

describe('POST /api/ingresos', () => {
  it('mapea el body a camelCase y deriva mes/anio de la fecha', async () => {
    await POST(post({ fecha: '2026-08-05', monto_moneda: 150000, moneda_id: 1, descripcion: 'Sueldo', casa_id: 2 }))
    expect(mp.ingreso.create.mock.calls[0][0].data).toEqual({
      fecha: '2026-08-05',
      mes: 8,
      anio: 2026,
      monedaId: 1,
      tipoCambio: 1,
      montoMoneda: 150000,
      descripcion: 'Sueldo',
      casaId: 2,
    })
  })

  it('guarda el tipo de cambio cuando el ingreso es en otra moneda', async () => {
    await POST(post({ fecha: '2026-08-05', monto_moneda: 1000, moneda_id: 2, tipo_cambio: 1350 }))
    expect(mp.ingreso.create.mock.calls[0][0].data).toMatchObject({
      monedaId: 2,
      montoMoneda: 1000,
      tipoCambio: 1350,
    })
  })

  it('acepta mes/anio explícitos para imputar el cobro a otro mes', async () => {
    await POST(post({ fecha: '2026-07-31', mes: 8, anio: 2026, monto_moneda: 1000, moneda_id: 1 }))
    expect(mp.ingreso.create.mock.calls[0][0].data).toMatchObject({ fecha: '2026-07-31', mes: 8, anio: 2026 })
  })

  it('devuelve 201 con el ingreso creado', async () => {
    const res = await POST(post({ fecha: '2026-08-05', monto_moneda: 150000, moneda_id: 1 }))
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ id: 1, monto_moneda: 150000, monto_ars: 150000, casa_id: 2 })
  })

  it('devuelve 400 sin tocar la DB si el body es inválido', async () => {
    for (const body of [{ monto_moneda: 100, moneda_id: 1 }, { fecha: '2026-08-05', monto_moneda: 100 }]) {
      vi.clearAllMocks()
      const res = await POST(post(body))
      expect(res.status).toBe(400)
      expect(mp.ingreso.create).not.toHaveBeenCalled()
    }
  })
})
