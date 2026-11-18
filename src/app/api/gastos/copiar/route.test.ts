import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    gasto: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    gastoItem: { create: vi.fn() },
  },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

function req(body: any) {
  return { json: async () => body } as any
}

function item(over: Record<string, any> = {}) {
  return {
    conceptoId: 20,
    monto: 100,
    fecha: '2026-11-02',
    cuotaActual: null,
    cuotasTotales: null,
    incluyeEnTotal: true,
    incluyeEnVencimiento: false,
    categoriaId: null,
    etiquetas: [],
    ...over,
  }
}

function resumen(over: Record<string, any> = {}) {
  return {
    id: 7,
    casaId: 1,
    conceptoId: 5,
    fechaVencimiento: '2026-11-10',
    tipoPago: 'D',
    monedaId: 1,
    tipoCambio: 1,
    totalMoneda: 0,
    tarjetaId: 3,
    cuotaActual: null,
    cuotasTotales: null,
    notas: null,
    categoriaId: null,
    etiquetas: [],
    esTarjeta: true,
    items: [
      item({ conceptoId: 20, cuotaActual: 2, cuotasTotales: 6 }),
      item({ conceptoId: 21, cuotaActual: 6, cuotasTotales: 6 }),
      item({ conceptoId: 22 }),
    ],
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mp.gasto.create.mockResolvedValue({ id: 99 })
  mp.gastoItem.create.mockResolvedValue({})
})

describe('POST /api/gastos/copiar', () => {
  it('400 sin source_id/mes/anio y 404 si el origen no existe', async () => {
    expect((await POST(req({ mes: 12 }))).status).toBe(400)
    mp.gasto.findUnique.mockResolvedValue(null)
    expect((await POST(req({ source_id: 7, mes: 12, anio: 2026 }))).status).toBe(404)
  })

  it('resumen de tarjeta: crea el del mes destino sólo con las cuotas pendientes, cuota +1', async () => {
    mp.gasto.findUnique.mockResolvedValue(resumen())
    mp.gasto.findFirst.mockResolvedValue(null)

    const res = await POST(req({ source_id: 7, mes: 12, anio: 2026 }))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ created: true, gasto_id: 99, added_items: 1 })

    const data = mp.gasto.create.mock.calls[0][0].data
    expect(data).toMatchObject({ mes: 12, anio: 2026, fechaVencimiento: '2026-12-10', esTarjeta: true, confirmado: false, totalPagado: 0 })
    expect(mp.gastoItem.create).toHaveBeenCalledTimes(1)
    expect(mp.gastoItem.create.mock.calls[0][0].data).toMatchObject({ gastoId: 99, conceptoId: 20, cuotaActual: 3, cuotasTotales: 6 })
  })

  it('merge: si el destino existe agrega sólo los sub-items cuyo concepto no esté', async () => {
    mp.gasto.findUnique.mockResolvedValue(
      resumen({ items: [item({ conceptoId: 20, cuotaActual: 2, cuotasTotales: 6 }), item({ conceptoId: 23, cuotaActual: 1, cuotasTotales: 3 })] }),
    )
    mp.gasto.findFirst.mockResolvedValue({ id: 50, items: [{ conceptoId: 20 }] })

    const res = await POST(req({ source_id: 7, mes: 12, anio: 2026 }))
    expect(await res.json()).toEqual({ merged: true, gasto_id: 50, added_items: 1 })
    expect(mp.gasto.create).not.toHaveBeenCalled()
    expect(mp.gastoItem.create.mock.calls[0][0].data).toMatchObject({ gastoId: 50, conceptoId: 23, cuotaActual: 2 })
  })
})
