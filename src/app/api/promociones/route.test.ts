import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    promocion: { findMany: vi.fn(), create: vi.fn() },
    gasto: { findMany: vi.fn() },
    promocionUso: { findMany: vi.fn() },
    promocionReintegro: { findMany: vi.fn() },
    promocionSaldoUso: { findMany: vi.fn() },
    concepto: { count: vi.fn() },
    categoria: { count: vi.fn() },
    etiqueta: { count: vi.fn() },
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
    ...over,
  }
}

const gasto = (promocionId: number, mes: number, totalMoneda: number, promocionFecha: string | null = null) =>
  ({ promocionId, mes, anio: 2026, promocionFecha, totalMoneda, tipoCambio: 1 })

beforeEach(() => {
  vi.clearAllMocks()
  mp.promocion.findMany.mockResolvedValue([])
  mp.gasto.findMany.mockResolvedValue([])
  mp.promocionUso.findMany.mockResolvedValue([])
  mp.promocionReintegro.findMany.mockResolvedValue([])
  mp.promocionSaldoUso.findMany.mockResolvedValue([])
})

describe('GET /api/promociones', () => {
  it('400 sin período válido, sin tocar la DB', async () => {
    const res = await GET(url('mes=13&anio=2026'))
    expect(res.status).toBe(400)
    expect(mp.promocion.findMany).not.toHaveBeenCalled()
  })

  it('una query por tabla con el histórico de TODAS las promos (lo necesita el saldo)', async () => {
    mp.promocion.findMany.mockResolvedValue([rawPromo(), rawPromo({ id: 2 }), rawPromo({ id: 3, conceptos: [] })])
    await GET(url('mes=10&anio=2026&hoy=2026-10-20'))

    expect(mp.promocion.findMany.mock.calls[0][0].include).toEqual({ conceptos: true, categorias: true, etiquetas: true, tarjetas: true })
    // El criterio es la asociación explícita, no el concepto: promo sin concepto también cuenta.
    const enPromos = { promocionId: { in: [1, 2, 3] } }
    expect(mp.gasto.findMany).toHaveBeenCalledTimes(1)
    expect(mp.gasto.findMany.mock.calls[0][0].where).toEqual(enPromos)
    expect(mp.promocionUso.findMany.mock.calls[0][0].where).toEqual(enPromos)
    expect(mp.promocionReintegro.findMany.mock.calls[0][0].where).toEqual(enPromos)
    expect(mp.promocionSaldoUso.findMany.mock.calls[0][0].where).toEqual(enPromos)
  })

  it('no consulta gastos si no hay promociones', async () => {
    await GET(url('mes=10&anio=2026'))
    expect(mp.gasto.findMany).not.toHaveBeenCalled()
  })

  it('suma consumo de los gastos asociados del ciclo (no los de otra promo ni otro mes) y los usos manuales', async () => {
    mp.promocion.findMany.mockResolvedValue([rawPromo()])
    mp.promocionUso.findMany.mockResolvedValue([
      { id: 1, promocionId: 1, fecha: '2026-10-08', mes: 10, anio: 2026, montoGasto: 5000, notas: null },
      { id: 2, promocionId: 1, fecha: '2026-09-08', mes: 9, anio: 2026, montoGasto: 9000, notas: null },
    ])
    mp.gasto.findMany.mockResolvedValue([gasto(1, 10, 15000), gasto(9, 10, 7000), gasto(1, 9, 3000)])

    const data = await (await GET(url('mes=10&anio=2026&hoy=2026-10-20'))).json()
    const p = data.promociones[0]

    expect(p).toMatchObject({ lugar: 'Carrefour', tope_mensual: 10000, tarjeta_ids: [10], vigente: true, dia_reinicio: 1 })
    expect(p.ciclo).toEqual({ mes: 10, anio: 2026, desde: '2026-10-01', hasta: '2026-10-31' })
    expect(p.progreso).toMatchObject({
      consumo_auto: 15000, consumo_manual: 5000, consumo: 20000,
      reintegrado: 4000, disponible: 6000, gasto_minimo: 50000, gasto_restante: 30000, estado: 'en_curso',
    })
    expect(p.usos.map((u: any) => u.id)).toEqual([1])
    expect(data.totales).toMatchObject({ tope_total: 10000, reintegrado: 4000, disponible: 6000, completas: 0 })
  })

  it('saldo a favor: lo reintegrado de todos los ciclos menos lo usado, y se suma lo nuevo', async () => {
    mp.promocion.findMany.mockResolvedValue([rawPromo()])
    // Septiembre: 25.000 → 5.000 reintegrados. Octubre: 10.000 → 2.000.
    mp.gasto.findMany.mockResolvedValue([gasto(1, 9, 25000), gasto(1, 10, 10000)])
    mp.promocionSaldoUso.findMany.mockResolvedValue([{ id: 4, promocionId: 1, fecha: '2026-10-02', monto: 2000, notas: null }])

    const data = await (await GET(url('mes=10&anio=2026&hoy=2026-10-20'))).json()
    const p = data.promociones[0]
    expect(p.saldo).toMatchObject({ disponible: 5000, reintegrado: 7000, usado: 2000, vencido: 0 })
    expect(p.saldo_usos).toEqual([{ id: 4, promocion_id: 1, fecha: '2026-10-02', monto: 2000, notas: null }])
    expect(data.totales.saldo).toBe(5000)
  })

  it('expone el vencimiento del reintegro del ciclo (null si no hay nada cargado) y lo aplica al saldo', async () => {
    mp.promocion.findMany.mockResolvedValue([rawPromo(), rawPromo({ id: 2 })])
    mp.gasto.findMany.mockResolvedValue([gasto(1, 10, 10000)])
    mp.promocionReintegro.findMany.mockResolvedValue([
      { promocionId: 1, mes: 10, anio: 2026, venceEl: '2026-10-15', utilizado: false },
    ])
    const data = await (await GET(url('mes=10&anio=2026&hoy=2026-10-20'))).json()
    expect(data.promociones[0].reintegro).toEqual({ vence_el: '2026-10-15', utilizado: false })
    expect(data.promociones[1].reintegro).toBeNull()
    // Venció el 15 y hoy es 20: se perdió.
    expect(data.promociones[0].saldo).toMatchObject({ disponible: 0, vencido: 2000 })
  })

  it('actual=1: cada promo en su ciclo en curso según su día de reinicio', async () => {
    mp.promocion.findMany.mockResolvedValue([rawPromo(), rawPromo({ id: 2, diaReinicio: 5 })])
    mp.gasto.findMany.mockResolvedValue([
      gasto(1, 12, 10000, '2026-12-03'),
      gasto(2, 12, 10000, '2026-12-03'), // antes del 5: ciclo de noviembre de la promo 2
    ])
    const data = await (await GET(url('mes=12&anio=2026&hoy=2026-12-03&actual=1'))).json()
    const [p1, p2] = data.promociones
    expect(p1.ciclo).toMatchObject({ mes: 12, desde: '2026-12-01' })
    expect(p1.progreso.consumo).toBe(10000)
    expect(p2.ciclo).toEqual({ mes: 11, anio: 2026, desde: '2026-11-05', hasta: '2026-12-04' })
    expect(p2.progreso.consumo).toBe(10000)

    // Sin actual: el ciclo que empieza en diciembre, que para la promo 2 todavía no tiene nada.
    const mes = await (await GET(url('mes=12&anio=2026&hoy=2026-12-03'))).json()
    expect(mes.promociones[1].ciclo.desde).toBe('2026-12-05')
    expect(mes.promociones[1].progreso.consumo).toBe(0)
  })

  it('una promo que arranca después del período no es vigente y no suma al total', async () => {
    mp.promocion.findMany.mockResolvedValue([rawPromo({ vigenteDesde: '2026-11-15' })])
    const data = await (await GET(url('mes=10&anio=2026'))).json()
    expect(data.promociones[0].vigente).toBe(false)
    expect(data.totales.tope_total).toBe(0)
  })
})

describe('POST /api/promociones', () => {
  const ok = { modalidad: 'virtual', lugar: 'Coto', porcentaje: 15, tope_mensual: 8000, dias: [1, 3], tarjeta_ids: [10], efectivo: true, concepto_ids: [5, 6], vigente_desde: '2026-10-15' }

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
      lugar: 'Coto', porcentaje: 15, topeMensual: 8000, dias: [1, 3], efectivo: true, modalidad: 'virtual', vigenteDesde: '2026-10-15', vigenteHasta: null, diaReinicio: 1,
      tarjetas: { connect: [{ id: 10 }] },
      conceptos: { connect: [{ id: 5 }, { id: 6 }] },
      categorias: { connect: [] },
      etiquetas: { connect: [] },
    })
  })

  it('conecta categorías y etiquetas vinculadas; 400 si alguna no existe', async () => {
    const conEjes = { ...ok, concepto_ids: [], categoria_ids: [2, 3], etiqueta_ids: [7] }
    mp.tarjeta.count.mockResolvedValue(1)
    mp.categoria.count.mockResolvedValue(1) // pidió 2, existe 1
    expect((await POST(body(conEjes))).status).toBe(400)

    mp.categoria.count.mockResolvedValue(2)
    mp.etiqueta.count.mockResolvedValue(0)
    expect((await POST(body(conEjes))).status).toBe(400)
    expect(mp.promocion.create).not.toHaveBeenCalled()

    mp.etiqueta.count.mockResolvedValue(1)
    mp.promocion.create.mockResolvedValue(rawPromo({ categorias: [{ id: 2, nombre: 'Comida' }], etiquetas: [{ id: 7, nombre: 'Delivery' }] }))
    const res = await POST(body(conEjes))
    expect(res.status).toBe(201)
    expect(mp.promocion.create.mock.calls[0][0].data).toMatchObject({
      categorias: { connect: [{ id: 2 }, { id: 3 }] },
      etiquetas: { connect: [{ id: 7 }] },
    })
    expect(mp.promocion.create.mock.calls[0][0].include).toEqual({ conceptos: true, categorias: true, etiquetas: true, tarjetas: true })
    expect(await res.json()).toMatchObject({ categoria_nombres: ['Comida'], etiqueta_nombres: ['Delivery'] })
  })
})
