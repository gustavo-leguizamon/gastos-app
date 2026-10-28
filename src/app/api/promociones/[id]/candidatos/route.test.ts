import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    promocion: { findUnique: vi.fn() },
    gasto: { findMany: vi.fn() },
  },
}))

import { GET } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any
const url = (qs: string) => ({ url: `http://localhost/api/promociones/1/candidatos?${qs}` }) as any
const params = (id: string) => ({ params: { id } })

const promo = { id: 1, conceptos: [{ id: 5 }, { id: 6 }], efectivo: false, tarjetas: [{ id: 10 }] }
const gasto = (over: Record<string, any> = {}) => ({
  id: 1, conceptoId: 5, concepto: { nombre: 'PedidosYa' }, fechaVencimiento: '2026-10-08', tipoPago: 'C',
  tarjetaId: 10, tarjeta: { nombre: 'Visa' }, totalMoneda: 1000, tipoCambio: 1, promocionId: null, ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  mp.promocion.findUnique.mockResolvedValue(promo)
  mp.gasto.findMany.mockResolvedValue([])
})

describe('GET /api/promociones/[id]/candidatos', () => {
  it('400 con id/período inválido o promo sin concepto; 404 si no existe', async () => {
    expect((await GET(url('mes=10&anio=2026'), params('x'))).status).toBe(400)
    expect((await GET(url('mes=13&anio=2026'), params('1'))).status).toBe(400)
    mp.promocion.findUnique.mockResolvedValue({ ...promo, conceptos: [] })
    expect((await GET(url('mes=10&anio=2026'), params('1'))).status).toBe(400)
    mp.promocion.findUnique.mockResolvedValue(null)
    expect((await GET(url('mes=10&anio=2026'), params('1'))).status).toBe(404)
  })

  it('pide los gastos del mes de CUALQUIERA de los conceptos (no resúmenes) o ya asociados a la promo', async () => {
    await GET(url('mes=10&anio=2026'), params('1'))
    expect(mp.gasto.findMany.mock.calls[0][0].where).toEqual({
      mes: 10, anio: 2026, esTarjeta: false, OR: [{ conceptoId: { in: [5, 6] } }, { promocionId: 1 }],
    })
  })

  it('un gasto de cualquiera de los conceptos vinculados es candidato', async () => {
    mp.gasto.findMany.mockResolvedValue([gasto({ id: 1, conceptoId: 5 }), gasto({ id: 2, conceptoId: 6 })])
    const r = await (await GET(url('mes=10&anio=2026'), params('1'))).json()
    expect(r.map((g: any) => g.id)).toEqual([1, 2])
  })

  it('deja los que coinciden en medio de pago y los ya asociados, aunque hoy no coincidan', async () => {
    mp.gasto.findMany.mockResolvedValue([
      gasto({ id: 1 }),
      gasto({ id: 2, tarjetaId: 99 }), // otra tarjeta: no es candidato
      gasto({ id: 3, tarjetaId: 99, promocionId: 1 }), // asociado: se muestra para poder soltarlo
      gasto({ id: 4, promocionId: 7 }), // de otra promo
    ])
    const r = await (await GET(url('mes=10&anio=2026'), params('1'))).json()
    expect(r.map((g: any) => g.id)).toEqual([1, 3, 4])
    expect(r.find((g: any) => g.id === 3).asociado).toBe(true)
    expect(r.find((g: any) => g.id === 4)).toMatchObject({ asociado: false, asociado_a_otra: true })
    expect(r[0]).toMatchObject({ descripcion: 'PedidosYa', total_ars: 1000, tarjeta_nombre: 'Visa' })
  })
})
