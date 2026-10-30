import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    promocion: { findMany: vi.fn(), create: vi.fn() },
    gasto: { findMany: vi.fn() },
    concepto: { count: vi.fn() },
    tarjeta: { count: vi.fn() },
  },
}))

import { GET, POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any
const url = (qs: string) => ({ url: `http://localhost/api/promociones?${qs}` }) as any
const body = (b: any) => ({ json: async () => b }) as any

/** 20% hasta $10.000 en Carrefour, con la tarjeta 10, jueves. */
function rawPromo(over: Record<string, any> = {}) {
  return {
    id: 1, lugar: 'Carrefour', conceptos: [{ id: 5, nombre: 'Carrefour' }],
    porcentaje: 20, topeMensual: 10000, dias: [3], efectivo: false, activa: true, notas: null,
    tarjetas: [{ id: 10, nombre: 'Visa', banco: null, marca: 'visa', bancoLogo: null, bancoIcono: null }],
    usos: [],
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mp.promocion.findMany.mockResolvedValue([])
  mp.gasto.findMany.mockResolvedValue([])
})

describe('GET /api/promociones', () => {
  it('400 sin período válido, sin tocar la DB', async () => {
    const res = await GET(url('mes=13&anio=2026'))
    expect(res.status).toBe(400)
    expect(mp.promocion.findMany).not.toHaveBeenCalled()
  })

  it('trae los usos del período y los gastos ASOCIADOS del mes en UNA query', async () => {
    mp.promocion.findMany.mockResolvedValue([rawPromo(), rawPromo({ id: 2 }), rawPromo({ id: 3, conceptos: [] })])
    await GET(url('mes=10&anio=2026'))

    expect(mp.promocion.findMany.mock.calls[0][0].include.usos).toEqual({
      where: { mes: 10, anio: 2026 },
      orderBy: { fecha: 'desc' },
    })
    expect(mp.promocion.findMany.mock.calls[0][0].include.reintegros).toEqual({ where: { mes: 10, anio: 2026 } })
    expect(mp.gasto.findMany).toHaveBeenCalledTimes(1)
    // El criterio es la asociación explícita, no el concepto: promo sin concepto también cuenta.
    expect(mp.gasto.findMany.mock.calls[0][0].where).toEqual({
      mes: 10, anio: 2026, promocionId: { in: [1, 2, 3] },
    })
  })

  it('no consulta gastos si no hay promociones', async () => {
    await GET(url('mes=10&anio=2026'))
    expect(mp.gasto.findMany).not.toHaveBeenCalled()
  })

  it('suma consumo de los gastos asociados (no los del mismo concepto sin asociar) y los usos manuales', async () => {
    mp.promocion.findMany.mockResolvedValue([
      rawPromo({ usos: [{ id: 1, promocionId: 1, fecha: '2026-10-08', mes: 10, anio: 2026, montoGasto: 5000, notas: null }] }),
    ])
    // La query ya filtra por promocionId; el cálculo suma lo que sea de ESA promo.
    mp.gasto.findMany.mockResolvedValue([
      { promocionId: 1, totalMoneda: 15000, tipoCambio: 1 },
      { promocionId: 9, totalMoneda: 7000, tipoCambio: 1 },
    ])

    const data = await (await GET(url('mes=10&anio=2026'))).json()
    const p = data.promociones[0]

    expect(p).toMatchObject({ lugar: 'Carrefour', tope_mensual: 10000, tarjeta_ids: [10], vigente: true })
    expect(p.progreso).toMatchObject({
      consumo_auto: 15000, consumo_manual: 5000, consumo: 20000,
      reintegrado: 4000, disponible: 6000, gasto_minimo: 50000, gasto_restante: 30000, estado: 'en_curso',
    })
    expect(p.usos).toHaveLength(1)
    expect(data.totales).toMatchObject({ tope_total: 10000, reintegrado: 4000, disponible: 6000, completas: 0 })
  })

  it('expone el vencimiento del reintegro del período (null si no hay nada cargado)', async () => {
    mp.promocion.findMany.mockResolvedValue([
      rawPromo({ reintegros: [{ venceEl: '2026-12-15', utilizado: false }] }),
      rawPromo({ id: 2, reintegros: [] }),
    ])
    const data = await (await GET(url('mes=10&anio=2026'))).json()
    expect(data.promociones[0].reintegro).toEqual({ vence_el: '2026-12-15', utilizado: false })
    expect(data.promociones[1].reintegro).toBeNull()
  })

  it('una promo que arranca después del período no es vigente y no suma al total', async () => {
    mp.promocion.findMany.mockResolvedValue([rawPromo({ vigenteDesde: '2026-11-15' })])
    const data = await (await GET(url('mes=10&anio=2026'))).json()
    expect(data.promociones[0].vigente).toBe(false)
    expect(data.totales.tope_total).toBe(0)
  })
})

describe('POST /api/promociones', () => {
  const ok = { lugar: 'Coto', porcentaje: 15, tope_mensual: 8000, dias: [1, 3], tarjeta_ids: [10], efectivo: true, concepto_ids: [5, 6], vigente_desde: '2026-10-15' }

  it('400 con body inválido sin tocar la DB', async () => {
    const res = await POST(body({ ...ok, dias: [] }))
    expect(res.status).toBe(400)
    expect(mp.promocion.create).not.toHaveBeenCalled()
  })

  it('400 si algún concepto o alguna tarjeta no existen', async () => {
    mp.concepto.count.mockResolvedValue(1) // pidió 2 conceptos, existe 1
    expect((await POST(body(ok))).status).toBe(400)

    mp.concepto.count.mockResolvedValue(2)
    mp.tarjeta.count.mockResolvedValue(0)
    expect((await POST(body(ok))).status).toBe(400)
    expect(mp.promocion.create).not.toHaveBeenCalled()
  })

  it('mapea a camelCase y conecta las tarjetas y los conceptos', async () => {
    mp.concepto.count.mockResolvedValue(2)
    mp.tarjeta.count.mockResolvedValue(1)
    mp.promocion.create.mockResolvedValue(rawPromo({ lugar: 'Coto' }))

    const res = await POST(body(ok))
    expect(res.status).toBe(201)
    expect(mp.promocion.create.mock.calls[0][0].data).toMatchObject({
      lugar: 'Coto', porcentaje: 15, topeMensual: 8000, dias: [1, 3], efectivo: true, vigenteDesde: '2026-10-15', vigenteHasta: null,
      tarjetas: { connect: [{ id: 10 }] },
      conceptos: { connect: [{ id: 5 }, { id: 6 }] },
    })
  })
})
