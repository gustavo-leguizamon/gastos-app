import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    gasto: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

import { PATCH } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const req = (body: any) => ({ json: async () => body }) as any

/** Fila cruda mínima que `toGastoResponse` sabe mapear. */
function rawGasto(over: Record<string, any> = {}) {
  return {
    id: 1,
    casaId: 1,
    conceptoId: 1,
    concepto: { nombre: 'Luz' },
    casa: { nombre: 'Casa' },
    moneda: { codigo: 'ARS', simbolo: '$' },
    tarjeta: null,
    categoria: null,
    etiquetas: [],
    fechaVencimiento: '2026-06-10',
    tipoPago: 'D',
    tipoCambio: 1,
    totalMoneda: 1000,
    pasajeMesSiguiente: 0,
    prestamo_a_otro: 0,
    cuotaActual: null,
    cuotasTotales: null,
    mes: 6,
    anio: 2026,
    notas: null,
    confirmado: true,
    esTarjeta: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    pagos: [],
    items: [],
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mp.gasto.findUnique.mockResolvedValue({ fechaVencimiento: '2026-06-10' })
  mp.gasto.update.mockResolvedValue(rawGasto())
})

describe('PATCH /api/gastos/[id]/periodo', () => {
  it('cambia mes y anio sin tocar la fecha por defecto', async () => {
    const res = await PATCH(req({ mes: 7, anio: 2026 }), { params: { id: '1' } })
    expect(res.status).toBe(200)
    expect(mp.gasto.update.mock.calls[0][0].where).toEqual({ id: 1 })
    expect(mp.gasto.update.mock.calls[0][0].data).toEqual({ mes: 7, anio: 2026 })
  })

  it('con mover_fecha reubica la fechaVencimiento conservando el día', async () => {
    await PATCH(req({ mes: 7, anio: 2026, mover_fecha: true }), { params: { id: '1' } })
    expect(mp.gasto.update.mock.calls[0][0].data).toEqual({
      mes: 7, anio: 2026, fechaVencimiento: '2026-07-10',
    })
  })

  it('recorta el día al último del mes destino', async () => {
    mp.gasto.findUnique.mockResolvedValue({ fechaVencimiento: '2026-01-31' })
    await PATCH(req({ mes: 2, anio: 2026, mover_fecha: true }), { params: { id: '1' } })
    expect(mp.gasto.update.mock.calls[0][0].data.fechaVencimiento).toBe('2026-02-28')
  })

  it('si la fecha guardada está mal formada mueve el período igual', async () => {
    mp.gasto.findUnique.mockResolvedValue({ fechaVencimiento: 'basura' })
    await PATCH(req({ mes: 7, anio: 2026, mover_fecha: true }), { params: { id: '1' } })
    expect(mp.gasto.update.mock.calls[0][0].data).toEqual({ mes: 7, anio: 2026 })
  })

  it('no toca montos, concepto ni clasificación aunque vengan en el body', async () => {
    await PATCH(req({ mes: 7, anio: 2026, total_moneda: 99999, concepto_id: 42 }), { params: { id: '1' } })
    expect(mp.gasto.update.mock.calls[0][0].data).toEqual({ mes: 7, anio: 2026 })
  })

  it('devuelve 400 con body inválido, sin tocar la DB', async () => {
    for (const body of [{}, { mes: 13, anio: 2026 }, { mes: 0, anio: 2026 }, { mes: 7 }]) {
      expect((await PATCH(req(body), { params: { id: '1' } })).status).toBe(400)
    }
    expect(mp.gasto.update).not.toHaveBeenCalled()
  })

  it('devuelve 400 con id inválido, sin leer la DB', async () => {
    const res = await PATCH(req({ mes: 7, anio: 2026 }), { params: { id: 'x' } })
    expect(res.status).toBe(400)
    expect(mp.gasto.findUnique).not.toHaveBeenCalled()
  })

  it('devuelve 404 si el gasto no existe', async () => {
    mp.gasto.findUnique.mockResolvedValue(null)
    const res = await PATCH(req({ mes: 7, anio: 2026 }), { params: { id: '9' } })
    expect(res.status).toBe(404)
    expect(mp.gasto.update).not.toHaveBeenCalled()
  })
})
