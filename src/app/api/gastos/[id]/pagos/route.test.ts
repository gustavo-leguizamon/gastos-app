import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    pago: { findMany: vi.fn(), create: vi.fn() },
    gasto: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    tarjetaCierre: { findUnique: vi.fn() },
    tarjeta: { findUnique: vi.fn() },
    moneda: { findFirst: vi.fn() },
    gastoItem: { create: vi.fn() },
    concepto: { findFirst: vi.fn(), create: vi.fn() },
  },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

function source(overrides: Record<string, any> = {}) {
  return {
    id: 1, casaId: 10, conceptoId: 11, tipoPago: 'C', tarjetaId: 7,
    mes: 6, anio: 2026, categorias: [], cuotaActual: null, cuotasTotales: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mp.pago.create.mockResolvedValue({ id: 100, gastoId: 1, fecha: '2026-06-25', monto: 500, createdAt: new Date('2026-06-25T00:00:00Z') })
  mp.concepto.findFirst.mockResolvedValue(null)
  mp.concepto.create.mockResolvedValue({ id: 60 })
})

describe('POST /api/gastos/[id]/pagos — propagación a tarjeta', () => {
  it('crea el pago y responde 201', async () => {
    mp.gasto.findUnique.mockResolvedValue(source({ tipoPago: 'D', tarjetaId: null }))
    const res = await POST({ json: async () => ({ fecha: '2026-06-25', monto: 500 }) } as any, { params: { id: '1' } })
    expect(res.status).toBe(201)
    expect(mp.pago.create).toHaveBeenCalledWith({ data: { gastoId: 1, fecha: '2026-06-25', monto: 500 } })
  })

  it('NO propaga cuando el gasto no es tarjeta de crédito (tipo D)', async () => {
    mp.gasto.findUnique.mockResolvedValue(source({ tipoPago: 'D' }))
    await POST({ json: async () => ({ fecha: '2026-06-25', monto: 500 }) } as any, { params: { id: '1' } })
    expect(mp.gastoItem.create).not.toHaveBeenCalled()
  })

  it('NO propaga cuando no hay tarjeta asociada', async () => {
    mp.gasto.findUnique.mockResolvedValue(source({ tarjetaId: null }))
    await POST({ json: async () => ({ fecha: '2026-06-25', monto: 500 }) } as any, { params: { id: '1' } })
    expect(mp.gastoItem.create).not.toHaveBeenCalled()
  })

  it('propaga al mes +1 cuando no hay próximo cierre, sobre el gasto CC existente', async () => {
    mp.gasto.findUnique.mockResolvedValue(source())
    mp.tarjetaCierre.findUnique.mockResolvedValue(null) // sin próximo cierre → shift +1
    mp.gasto.findFirst.mockResolvedValue({ id: 555 }) // targetCC ya existe

    await POST({ json: async () => ({ fecha: '2026-06-25', monto: 500 }) } as any, { params: { id: '1' } })

    // target = mes 7 (6 + 1)
    expect(mp.gasto.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ esTarjeta: true, tarjetaId: 7, mes: 7, anio: 2026 }),
    }))
    expect(mp.gasto.create).not.toHaveBeenCalled() // no crea porque ya existe
    // El item propagado hereda el conceptoId del gasto fuente
    expect(mp.gastoItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ gastoId: 555, monto: 500, fecha: '2026-06-25', conceptoId: 11 }),
    }))
  })

  it('propaga al mes +2 cuando la fecha del pago es posterior al próximo cierre', async () => {
    mp.gasto.findUnique.mockResolvedValue(source())
    mp.tarjetaCierre.findUnique.mockResolvedValue({ fechaProximoCierre: '2026-06-20' }) // fecha 06-25 > 06-20 → shift +2
    mp.gasto.findFirst.mockResolvedValue({ id: 777 })

    await POST({ json: async () => ({ fecha: '2026-06-25', monto: 500 }) } as any, { params: { id: '1' } })

    // target = mes 8 (6 + 2)
    expect(mp.gasto.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ mes: 8, anio: 2026 }),
    }))
  })

  it('crea el gasto CC target cuando no existe, con esTarjeta=true y confirmado=false', async () => {
    mp.gasto.findUnique.mockResolvedValue(source())
    mp.tarjetaCierre.findUnique.mockResolvedValue(null)
    mp.gasto.findFirst.mockResolvedValue(null) // no existe → hay que crearlo
    mp.tarjeta.findUnique.mockResolvedValue({ id: 7, nombre: 'Visa', banco: 'Galicia' })
    mp.moneda.findFirst.mockResolvedValue({ id: 1, codigo: 'ARS' })
    mp.gasto.create.mockResolvedValue({ id: 999 })

    await POST({ json: async () => ({ fecha: '2026-06-25', monto: 500 }) } as any, { params: { id: '1' } })

    // El nombre de la tarjeta se resuelve a un concepto (id 60)
    expect(mp.concepto.create).toHaveBeenCalledWith(expect.objectContaining({ data: { nombre: 'Visa (Galicia)' } }))
    expect(mp.gasto.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        esTarjeta: true, confirmado: false, tipoPago: 'D', tarjetaId: 7, mes: 7, anio: 2026,
        conceptoId: 60,
      }),
    }))
    expect(mp.gasto.create.mock.calls[0][0].data).not.toHaveProperty('descripcion')
    expect(mp.gastoItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ gastoId: 999, monto: 500, conceptoId: 11 }),
    }))
  })
})
