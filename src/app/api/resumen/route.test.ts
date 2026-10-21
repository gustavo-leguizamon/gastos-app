import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    settings: { upsert: vi.fn() },
    ingreso: { findMany: vi.fn() },
    gasto: { findMany: vi.fn() },
  },
}))

import { GET } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const SETTINGS = { id: 1, estimMesesAtras: 1, estimMissingBehavior: 'zero', estimIncluirCuotasVigentes: false, estimExcluirUltimaCuota: false }

const get = (qs: string) => ({ url: `http://localhost/api/resumen${qs}` }) as any

const gasto = (overrides: Record<string, any> = {}) => ({
  id: 1, casaId: 1, conceptoId: 100, concepto: { nombre: 'Luz' }, tipoPago: 'D', esTarjeta: false,
  tipoCambio: 1, totalMoneda: 1000, pasajeMesSiguiente: 0, cuotaActual: null, cuotasTotales: null,
  fechaVencimiento: '2026-10-10', confirmado: true, pagos: [], items: [], ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mp.settings.upsert.mockResolvedValue(SETTINGS)
  mp.ingreso.findMany.mockResolvedValue([])
  mp.gasto.findMany.mockResolvedValue([])
})

describe('GET /api/resumen', () => {
  it('sin casa: trae el mes y los meses previos sin filtro de casa', async () => {
    await GET(get('?mes=10&anio=2026&today=2026-10-21'))
    const [actual, previo] = mp.gasto.findMany.mock.calls.map((c: any[]) => c[0])
    expect(actual.where).toEqual({ mes: 10, anio: 2026 })
    expect(previo.where).toEqual({ mes: 9, anio: 2026 })
  })

  it('con casa: suma los resúmenes de tarjeta de todas las casas e incluye la casa de origen de cada sub-item', async () => {
    await GET(get('?mes=1&anio=2026&casa_id=3'))
    const [actual, previo] = mp.gasto.findMany.mock.calls.map((c: any[]) => c[0])
    const OR = [{ casaId: 3 }, { esTarjeta: true }]
    expect(actual.where).toEqual({ mes: 1, anio: 2026, OR })
    // Wraparound de año en el mes previo.
    expect(previo.where).toEqual({ mes: 12, anio: 2025, OR })
    const origen = { pago: { select: { gasto: { select: { casaId: true } } } } }
    expect(actual.include.items.include).toMatchObject(origen)
    expect(previo.include.items.include).toEqual(origen)
  })

  it('con casa: los totales usan sólo los gastos de la casa, el estimado también los consumos propios de otros resúmenes', async () => {
    const item = { conceptoId: 5, concepto: { nombre: 'Super' }, monto: 200, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: null }
    mp.gasto.findMany
      .mockResolvedValueOnce([
        gasto({ id: 1, casaId: 3, totalMoneda: 1000 }),
        gasto({
          id: 2, casaId: 8, conceptoId: 9, concepto: { nombre: 'Visa' }, esTarjeta: true, totalMoneda: 900,
          items: [{ ...item, pago: { gasto: { casaId: 3 } } }, { ...item, conceptoId: 6, monto: 700, pago: { gasto: { casaId: 8 } } }],
        }),
      ])
      .mockResolvedValueOnce([])
    const res = await GET(get('?mes=10&anio=2026&casa_id=3&today=2026-10-21'))
    const body = await res.json()
    expect(body.total_gastos).toBe(1000)
    // Luz (1000 + 0) / 2 + Super del resumen de la otra casa (200 + 0) / 2
    expect(body.total_proximo_mes).toBe(600)
    expect(body.detalle_proximo_mes.map((d: any) => d.descripcion).sort()).toEqual(['Luz', 'Super'])
  })
})
