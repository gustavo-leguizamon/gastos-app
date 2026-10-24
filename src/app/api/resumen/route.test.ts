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

  it('con casa: filtra el mes y los previos por casa (con wraparound de año) y trae el concepto para rotular', async () => {
    await GET(get('?mes=1&anio=2026&casa_id=3'))
    const [actual, previo] = mp.gasto.findMany.mock.calls.map((c: any[]) => c[0])
    expect(actual.where).toEqual({ mes: 1, anio: 2026, casaId: 3 })
    expect(previo.where).toEqual({ mes: 12, anio: 2025, casaId: 3 })
    expect(actual.include.concepto).toEqual({ select: { nombre: true } })
    expect(actual.include.items.include.concepto).toEqual({ select: { nombre: true } })
  })

  it('el estimado cuenta el gasto con crédito y no su sub-item propagado al resumen', async () => {
    const propagado = { conceptoId: 100, concepto: { nombre: 'Luz' }, monto: 1000, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: null, pagoId: 9 }
    mp.gasto.findMany
      .mockResolvedValueOnce([
        gasto({ id: 1, tipoPago: 'C' }),
        gasto({ id: 2, conceptoId: 9, concepto: { nombre: 'Visa' }, esTarjeta: true, items: [propagado] }),
      ])
      .mockResolvedValueOnce([])
    const body = await (await GET(get('?mes=10&anio=2026&today=2026-10-21'))).json()
    // Luz (1000 + 0) / 2, una sola vez
    expect(body.total_proximo_mes).toBe(500)
    expect(body.detalle_proximo_mes).toHaveLength(1)
  })
})
