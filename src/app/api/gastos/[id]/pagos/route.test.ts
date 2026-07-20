import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    pago: { findMany: vi.fn(), create: vi.fn() },
    gasto: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    tarjetaCierre: { findUnique: vi.fn(), findMany: vi.fn() },
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
    mes: 6, anio: 2026, etiquetas: [], cuotaActual: null, cuotasTotales: null,
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

  it('propaga al resumen que cierra después cuando el pago es posterior al cierre del mes', async () => {
    mp.gasto.findUnique.mockResolvedValue(source())
    // El resumen de junio cierra el 02/06; el de julio cierra el 02/07.
    mp.tarjetaCierre.findMany.mockResolvedValue([
      { mes: 6, anio: 2026, fechaCierre: '2026-06-02' },
      { mes: 7, anio: 2026, fechaCierre: '2026-07-02' },
    ])
    mp.gasto.findFirst.mockResolvedValue({ id: 555 }) // targetCC ya existe

    // pago el 25-jun (posterior al cierre del 02/06) → primer cierre >= 25/06 es 02/07 → resumen de julio
    await POST({ json: async () => ({ fecha: '2026-06-25', monto: 500 }) } as any, { params: { id: '1' } })

    expect(mp.gasto.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ esTarjeta: true, tarjetaId: 7, mes: 7, anio: 2026 }),
    }))
    expect(mp.gasto.create).not.toHaveBeenCalled() // no crea porque ya existe
    // El item propagado hereda el conceptoId del gasto fuente
    expect(mp.gastoItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ gastoId: 555, monto: 500, fecha: '2026-06-25', conceptoId: 11 }),
    }))
  })

  it('propaga al resumen que cierra en/después de la fecha cuando el pago es anterior/igual al cierre', async () => {
    // Gasto fuente clasificado en julio; pago el 1-jul, el resumen de julio cierra el 02/07.
    // El pago entra en el resumen de julio (primer cierre >= 01/07 es 02/07).
    mp.gasto.findUnique.mockResolvedValue(source({ mes: 7, anio: 2026 }))
    mp.tarjetaCierre.findMany.mockResolvedValue([
      { mes: 7, anio: 2026, fechaCierre: '2026-07-02' },
    ])
    mp.pago.create.mockResolvedValue({ id: 100, gastoId: 1, fecha: '2026-07-01', monto: 500, createdAt: new Date('2026-07-01T00:00:00Z') })
    mp.gasto.findFirst.mockResolvedValue({ id: 555 })

    await POST({ json: async () => ({ fecha: '2026-07-01', monto: 500 }) } as any, { params: { id: '1' } })

    // primer cierre >= 01/07 es 02/07 → resumen de julio
    expect(mp.gasto.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ mes: 7, anio: 2026 }),
    }))
  })

  it('responde 400 y NO crea el pago cuando la tarjeta no tiene cierre configurado', async () => {
    mp.gasto.findUnique.mockResolvedValue(source())
    mp.tarjetaCierre.findMany.mockResolvedValue([]) // ningún cierre con fechaCierre en toda la tarjeta

    const res = await POST({ json: async () => ({ fecha: '2026-06-25', monto: 500 }) } as any, { params: { id: '1' } })

    expect(res.status).toBe(400)
    expect(mp.pago.create).not.toHaveBeenCalled()
    expect(mp.gastoItem.create).not.toHaveBeenCalled()
  })

  it('fallback: usa el día del último cierre cuando el pago es posterior a todos los cierres conocidos', async () => {
    mp.gasto.findUnique.mockResolvedValue(source())
    // Solo hay cierres hasta el 02/05 (día 2); el pago del 25-jun es posterior a todos.
    mp.tarjetaCierre.findMany.mockResolvedValue([{ mes: 5, anio: 2026, fechaCierre: '2026-05-02' }])
    mp.gasto.findFirst.mockResolvedValue({ id: 555 })

    await POST({ json: async () => ({ fecha: '2026-06-25', monto: 500 }) } as any, { params: { id: '1' } })

    // día 25 > 2 (día del último cierre) → resumen de julio
    expect(mp.gasto.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ mes: 7, anio: 2026 }),
    }))
  })

  it('crea el gasto CC target cuando no existe, con esTarjeta=true y confirmado=false', async () => {
    mp.gasto.findUnique.mockResolvedValue(source())
    mp.tarjetaCierre.findMany.mockResolvedValue([
      { mes: 6, anio: 2026, fechaCierre: '2026-06-02' },
      { mes: 7, anio: 2026, fechaCierre: '2026-07-02' },
    ])
    // findUnique se usa dentro de la propagación para el fechaVencimiento del target (julio).
    mp.tarjetaCierre.findUnique.mockResolvedValue({ fechaVencimiento: '2026-07-10' })
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
