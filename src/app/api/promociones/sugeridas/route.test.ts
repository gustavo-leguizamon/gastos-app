import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    concepto: { findFirst: vi.fn() },
    promocion: { findMany: vi.fn() },
    gasto: { findMany: vi.fn() },
  },
}))

import { GET } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any
const url = (qs: string) => ({ url: `http://localhost/api/promociones/sugeridas?${qs}` }) as any

/** 30% hasta $30.000 en PedidosYa, con la tarjeta 10 (no vale en efectivo). */
function rawPromo(over: Record<string, any> = {}) {
  return {
    id: 1, lugar: 'PedidosYa', conceptoId: 5, concepto: { id: 5, nombre: 'PedidosYa' },
    porcentaje: 30, topeMensual: 30000, dias: [1], efectivo: false, activa: true, notas: null,
    vigenteDesde: null, vigenteHasta: null,
    tarjetas: [{ id: 10, nombre: 'Visa', banco: null, marca: 'visa', bancoLogo: null, bancoIcono: null }],
    usos: [],
    ...over,
  }
}

const base = 'descripcion=pedidosya&tipo_pago=C&tarjeta_id=10&mes=10&anio=2026'

beforeEach(() => {
  vi.clearAllMocks()
  mp.concepto.findFirst.mockResolvedValue({ id: 5, nombre: 'PedidosYa' })
  mp.promocion.findMany.mockResolvedValue([rawPromo()])
  mp.gasto.findMany.mockResolvedValue([])
})

describe('GET /api/promociones/sugeridas', () => {
  it('400 sin período válido', async () => {
    expect((await GET(url('descripcion=x&mes=0&anio=2026'))).status).toBe(400)
  })

  it('sin concepto reconocido ni promo forzada devuelve [] sin consultar promos', async () => {
    mp.concepto.findFirst.mockResolvedValue(null)
    const res = await GET(url(base))
    expect(await res.json()).toEqual([])
    expect(mp.promocion.findMany).not.toHaveBeenCalled()
  })

  it('busca el concepto sin distinguir mayúsculas y sólo trae promos activas de ese concepto', async () => {
    await GET(url(base))
    expect(mp.concepto.findFirst).toHaveBeenCalledWith({ where: { nombre: { equals: 'pedidosya', mode: 'insensitive' } } })
    expect(mp.promocion.findMany.mock.calls[0][0].where).toEqual({ OR: [{ activa: true, conceptoId: 5 }] })
  })

  it('sugiere la promo con lo que queda por reintegrar', async () => {
    mp.gasto.findMany.mockResolvedValue([{ promocionId: 1, totalMoneda: 50000, tipoCambio: 1 }]) // 15.000 reintegrados
    const [s] = await (await GET(url(base))).json()
    expect(s).toEqual({ id: 1, lugar: 'PedidosYa', porcentaje: 30, disponible: 15000, tope_alcanzado: false, coincide: true })
  })

  it('marca tope alcanzado', async () => {
    mp.gasto.findMany.mockResolvedValue([{ promocionId: 1, totalMoneda: 100000, tipoCambio: 1 }])
    const [s] = await (await GET(url(base))).json()
    expect(s).toMatchObject({ tope_alcanzado: true, disponible: 0 })
  })

  it('no sugiere si el medio de pago no entra (otra tarjeta, o efectivo sin que la promo lo admita)', async () => {
    expect(await (await GET(url('descripcion=pedidosya&tipo_pago=C&tarjeta_id=99&mes=10&anio=2026'))).json()).toEqual([])
    expect(await (await GET(url('descripcion=pedidosya&tipo_pago=D&mes=10&anio=2026'))).json()).toEqual([])
  })

  it('sugiere en efectivo (débito sin tarjeta) cuando la promo lo admite', async () => {
    mp.promocion.findMany.mockResolvedValue([rawPromo({ efectivo: true })])
    const r = await (await GET(url('descripcion=pedidosya&tipo_pago=D&mes=10&anio=2026'))).json()
    expect(r).toHaveLength(1)
  })

  it('no sugiere un gasto de un mes anterior al inicio de la promo, ni uno posterior a su fin', async () => {
    mp.promocion.findMany.mockResolvedValue([rawPromo({ vigenteDesde: '2026-11-15' })])
    expect(await (await GET(url(base))).json()).toEqual([])
    mp.promocion.findMany.mockResolvedValue([rawPromo({ vigenteHasta: '2026-09-30' })])
    expect(await (await GET(url(base))).json()).toEqual([])
  })

  it('una promo que arranca a mitad del mes sí se sugiere ese mes', async () => {
    mp.promocion.findMany.mockResolvedValue([rawPromo({ vigenteDesde: '2026-10-15' })])
    expect(await (await GET(url(base))).json()).toHaveLength(1)
  })

  it('promocion_id fuerza a incluir la promo ya asociada aunque no coincida, marcada coincide: false', async () => {
    mp.promocion.findMany.mockResolvedValue([rawPromo({ activa: false })])
    const r = await (await GET(url(`${base}&promocion_id=1`))).json()
    expect(mp.promocion.findMany.mock.calls[0][0].where).toEqual({ OR: [{ activa: true, conceptoId: 5 }, { id: 1 }] })
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ id: 1, coincide: false })
  })

  it('con promocion_id y sin concepto reconocido igual devuelve la asociada', async () => {
    mp.concepto.findFirst.mockResolvedValue(null)
    const r = await (await GET(url('descripcion=otra&tipo_pago=D&mes=10&anio=2026&promocion_id=1'))).json()
    expect(r).toHaveLength(1)
    expect(r[0].coincide).toBe(false)
  })
})
