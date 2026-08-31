import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    gasto: { findMany: vi.fn() },
  },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const body = (b: any) => ({ json: async () => b }) as any

function gasto(over: Record<string, any> = {}) {
  return {
    conceptoId: 1,
    concepto: { id: 1, nombre: 'Algo' },
    totalMoneda: 1000,
    tipoCambio: 1,
    confirmado: true,
    esTarjeta: false,
    tipoPago: 'D',
    categoriaId: null,
    categoria: null,
    etiquetas: [],
    items: [],
    mes: 4,
    anio: 2026,
    ...over,
  }
}

const cat = (id: number, nombre: string) => ({ categoriaId: id, categoria: { id, nombre } })

const montoDe = (p: any, id: number) => p.filas.find((f: any) => f.categoria_id === id)?.monto

const ok = { mes: 6, anio: 2026, objetivo: 200, ingresos_esperados: 1000, meses_historico: 2 }

beforeEach(() => {
  vi.clearAllMocks()
  mp.gasto.findMany.mockResolvedValue([])
})

describe('POST /api/presupuestos/generar', () => {
  it('400 con body inválido, sin tocar la DB', async () => {
    for (const b of [{}, { ...ok, objetivo: -1 }, { ...ok, mes: 13 }, { ...ok, ingresos_esperados: null }]) {
      expect((await POST(body(b))).status).toBe(400)
    }
    expect(mp.gasto.findMany).not.toHaveBeenCalled()
  })

  it('promedia los meses previos, sin incluir el mes que se presupuesta', async () => {
    await POST(body(ok))
    expect(mp.gasto.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ mes: 4, anio: 2026 }, { mes: 5, anio: 2026 }],
    })
  })

  it('devuelve una propuesta por base, con el reparto escalado al disponible', async () => {
    mp.gasto.findMany.mockResolvedValue([
      // Débito: cuenta en las dos bases.
      gasto({ mes: 4, ...cat(7, 'Mercados'), tipoPago: 'D', totalMoneda: 1000 }),
      gasto({ mes: 5, ...cat(7, 'Mercados'), tipoPago: 'D', totalMoneda: 1000 }),
      // Crédito sin pagar: sólo devengado.
      gasto({ mes: 4, ...cat(11, 'Ocio'), tipoPago: 'C', totalMoneda: 400 }),
      gasto({ mes: 5, ...cat(11, 'Ocio'), tipoPago: 'C', totalMoneda: 400 }),
    ])

    const data = await (await POST(body(ok))).json()

    // Disponible = 1000 − 200 = 800.
    expect(data.propuestas.devengado.disponible).toBe(800)
    expect(montoDe(data.propuestas.devengado, 7)).toBe(571.43)
    expect(montoDe(data.propuestas.devengado, 11)).toBe(228.57)
    expect(data.propuestas.devengado.asignado).toBe(800)

    // En caja el consumo de crédito todavía no salió de la cuenta: no hay tope para Ocio.
    expect(montoDe(data.propuestas.caja, 7)).toBe(800)
    expect(montoDe(data.propuestas.caja, 11)).toBeUndefined()
    expect(data.propuestas.caja.asignado).toBe(800)
  })

  it('reserva las categorías fijas a su promedio', async () => {
    mp.gasto.findMany.mockResolvedValue([
      gasto({ mes: 4, ...cat(7, 'Mercados'), totalMoneda: 1000 }),
      gasto({ mes: 5, ...cat(7, 'Mercados'), totalMoneda: 1000 }),
      gasto({ mes: 4, ...cat(20, 'Alquiler'), totalMoneda: 400 }),
      gasto({ mes: 5, ...cat(20, 'Alquiler'), totalMoneda: 400 }),
    ])

    const data = await (await POST(body({ ...ok, categorias_fijas: [20] }))).json()

    expect(montoDe(data.propuestas.devengado, 20)).toBe(400)
    expect(montoDe(data.propuestas.devengado, 7)).toBe(400)
    expect(data.propuestas.devengado.estado).toBe('ok')
  })

  it('no persiste nada: la propuesta se confirma en el wizard', async () => {
    await POST(body(ok))
    // El mock sólo expone lecturas; si la route escribiera, fallaría acá.
    expect(Object.keys(mp)).toEqual(['gasto'])
  })

  it('informa la ventana y los supuestos con los que se generó', async () => {
    const data = await (await POST(body(ok))).json()
    expect(data).toMatchObject({
      mes: 6,
      anio: 2026,
      objetivo: 200,
      ingresos_esperados: 1000,
      meses_historico: 2,
      ventana: [{ mes: 4, anio: 2026 }, { mes: 5, anio: 2026 }],
    })
  })
})
