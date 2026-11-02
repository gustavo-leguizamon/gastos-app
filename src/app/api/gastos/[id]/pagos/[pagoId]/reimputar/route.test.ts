import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    pago: { findUnique: vi.fn() },
    gasto: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    gastoItem: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    tarjetaCierre: { findMany: vi.fn(), findUnique: vi.fn() },
    tarjeta: { findUnique: vi.fn() },
    moneda: { findFirst: vi.fn() },
    concepto: { findFirst: vi.fn(), create: vi.fn() },
  },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any
const call = (id = '1', pagoId = '100') => POST({} as any, { params: { id, pagoId } })

const CIERRES = [
  { mes: 11, anio: 2026, fechaCierre: '2026-11-05' },
  { mes: 12, anio: 2026, fechaCierre: '2026-12-05' },
]

beforeEach(() => {
  vi.clearAllMocks()
  mp.pago.findUnique.mockResolvedValue({ id: 100, gastoId: 1, fecha: '2026-11-20', monto: 500 })
  mp.gasto.findUnique.mockResolvedValue({ id: 1, tipoPago: 'C', tarjetaId: 7, casaId: 10, conceptoId: 11, etiquetas: [] })
  mp.tarjetaCierre.findMany.mockResolvedValue(CIERRES)
})

describe('POST /api/gastos/[id]/pagos/[pagoId]/reimputar', () => {
  it('400 con ids inválidos', async () => {
    expect((await call('x', '1')).status).toBe(400)
  })

  it('404 si el pago no pertenece al gasto', async () => {
    mp.pago.findUnique.mockResolvedValue({ id: 100, gastoId: 99, fecha: '2026-11-20', monto: 500 })
    expect((await call()).status).toBe(404)
  })

  it('400 si el gasto no es de crédito', async () => {
    mp.gasto.findUnique.mockResolvedValue({ id: 1, tipoPago: 'D', tarjetaId: null, etiquetas: [] })
    expect((await call()).status).toBe(400)
  })

  it('400 si la tarjeta no tiene cierres', async () => {
    mp.tarjetaCierre.findMany.mockResolvedValue([])
    expect((await call()).status).toBe(400)
  })

  it('mueve el sub-item al resumen correcto (sin borrar ni recrear)', async () => {
    // Pago del 20/11 → cierre del 05/12 → resumen de diciembre; estaba en noviembre.
    mp.gastoItem.findFirst.mockResolvedValue({ id: 900, gasto: { mes: 11, anio: 2026 } })
    mp.gasto.findFirst.mockResolvedValue({ id: 555 })
    const res = await call()
    expect(await res.json()).toEqual({ moved: true, created: false, mes: 12, anio: 2026 })
    expect(mp.gastoItem.update).toHaveBeenCalledWith({ where: { id: 900 }, data: { gastoId: 555 } })
    expect(mp.gastoItem.create).not.toHaveBeenCalled()
  })

  it('crea el resumen del período si todavía no existe', async () => {
    mp.gastoItem.findFirst.mockResolvedValue({ id: 900, gasto: { mes: 11, anio: 2026 } })
    mp.gasto.findFirst.mockResolvedValue(null)
    mp.tarjeta.findUnique.mockResolvedValue({ id: 7, nombre: 'Visa', banco: null })
    mp.moneda.findFirst.mockResolvedValue({ id: 1 })
    mp.tarjetaCierre.findUnique.mockResolvedValue(null)
    mp.concepto.create.mockResolvedValue({ id: 60 })
    mp.gasto.create.mockResolvedValue({ id: 777 })
    await call()
    expect(mp.gasto.create).toHaveBeenCalled()
    expect(mp.gastoItem.update).toHaveBeenCalledWith({ where: { id: 900 }, data: { gastoId: 777 } })
  })

  it('no hace nada si ya está en el resumen correcto', async () => {
    mp.gastoItem.findFirst.mockResolvedValue({ id: 900, gasto: { mes: 12, anio: 2026 } })
    const res = await call()
    expect((await res.json()).moved).toBe(false)
    expect(mp.gastoItem.update).not.toHaveBeenCalled()
  })

  it('crea el sub-item si la propagación original había fallado', async () => {
    mp.gastoItem.findFirst.mockResolvedValue(null)
    mp.gasto.findFirst.mockResolvedValue({ id: 555 })
    const res = await call()
    expect((await res.json()).created).toBe(true)
    expect(mp.gastoItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ gastoId: 555, pagoId: 100, monto: 500 }),
    }))
  })
})
