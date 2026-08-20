import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    presupuesto: { findMany: vi.fn(), upsert: vi.fn() },
    gasto: { findMany: vi.fn() },
    categoria: { findUnique: vi.fn() },
  },
}))

import { GET, POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const url = (qs: string) => ({ url: `http://localhost/api/presupuestos?${qs}` }) as any
const body = (b: any) => ({ json: async () => b }) as any

/** Fila cruda de gasto con lo mínimo que `computeReportes` necesita. */
function rawGasto(over: Record<string, any> = {}) {
  return {
    conceptoId: 1,
    concepto: { id: 1, nombre: 'Super' },
    totalMoneda: 1000,
    tipoCambio: 1,
    confirmado: true,
    categoriaId: null,
    categoria: null,
    etiquetas: [],
    items: [],
    mes: 6,
    anio: 2026,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mp.presupuesto.findMany.mockResolvedValue([])
  mp.gasto.findMany.mockResolvedValue([])
})

describe('GET /api/presupuestos', () => {
  it('400 si falta mes o anio', async () => {
    expect((await GET(url('anio=2026'))).status).toBe(400)
    expect((await GET(url('mes=13&anio=2026'))).status).toBe(400)
    expect(mp.presupuesto.findMany).not.toHaveBeenCalled()
  })

  it('consulta los presupuestos del período', async () => {
    await GET(url('mes=6&anio=2026'))
    expect(mp.presupuesto.findMany.mock.calls[0][0].where).toEqual({ mes: 6, anio: 2026 })
  })

  it('excluye los resúmenes de tarjeta del gasto (ya contados como individuales)', async () => {
    await GET(url('mes=6&anio=2026'))
    expect(mp.gasto.findMany.mock.calls[0][0].where).toEqual({ mes: 6, anio: 2026, esTarjeta: false })
  })

  it('cruza tope y gasto en la ejecución', async () => {
    mp.presupuesto.findMany.mockResolvedValue([
      { id: 1, categoriaId: 7, mes: 6, anio: 2026, monto: 10000, categoria: { nombre: 'Comida' } },
    ])
    mp.gasto.findMany.mockResolvedValue([
      rawGasto({ categoriaId: 7, categoria: { id: 7, nombre: 'Comida' }, totalMoneda: 4000 }),
    ])

    const data = await (await GET(url('mes=6&anio=2026'))).json()

    expect(data.ejecucion).toHaveLength(1)
    expect(data.ejecucion[0]).toMatchObject({
      categoria_id: 7, monto: 10000, gastado: 4000, restante: 6000, consumido_pct: 40, estado: 'ok',
    })
    expect(data.totales).toMatchObject({ presupuestado: 10000, gastado: 4000, excedidas: 0 })
  })

  it('marca excedido y lo cuenta en los totales', async () => {
    mp.presupuesto.findMany.mockResolvedValue([
      { id: 1, categoriaId: 7, mes: 6, anio: 2026, monto: 1000, categoria: { nombre: 'Comida' } },
    ])
    mp.gasto.findMany.mockResolvedValue([
      rawGasto({ categoriaId: 7, categoria: { id: 7, nombre: 'Comida' }, totalMoneda: 1500 }),
    ])

    const data = await (await GET(url('mes=6&anio=2026'))).json()
    expect(data.ejecucion[0].estado).toBe('excedido')
    expect(data.totales.excedidas).toBe(1)
  })

  it('el gasto sin presupuesto aparece aparte y no infla el consumido', async () => {
    mp.gasto.findMany.mockResolvedValue([
      rawGasto({ categoriaId: 9, categoria: { id: 9, nombre: 'Transporte' }, totalMoneda: 800 }),
    ])
    const data = await (await GET(url('mes=6&anio=2026'))).json()
    expect(data.ejecucion[0]).toMatchObject({ categoria_id: 9, monto: null, gastado: 800 })
    expect(data.totales.sin_presupuesto).toBe(800)
    expect(data.totales.gastado).toBe(0)
  })
})

describe('POST /api/presupuestos', () => {
  beforeEach(() => {
    mp.categoria.findUnique.mockResolvedValue({ id: 7, nombre: 'Comida' })
    mp.presupuesto.upsert.mockImplementation(async ({ create }: any) => ({
      id: 1, ...create, categoria: { nombre: 'Comida' },
    }))
  })

  it('upsertea por (categoria, mes, anio)', async () => {
    const res = await POST(body({ categoria_id: 7, mes: 6, anio: 2026, monto: 5000 }))
    expect(res.status).toBe(201)
    const arg = mp.presupuesto.upsert.mock.calls[0][0]
    expect(arg.where).toEqual({ categoriaId_mes_anio: { categoriaId: 7, mes: 6, anio: 2026 } })
    expect(arg.create).toMatchObject({ categoriaId: 7, mes: 6, anio: 2026, monto: 5000 })
    expect(arg.update).toEqual({ monto: 5000 })
  })

  it('acepta monto 0', async () => {
    expect((await POST(body({ categoria_id: 7, mes: 6, anio: 2026, monto: 0 }))).status).toBe(201)
  })

  it('400 con body inválido, sin tocar la DB', async () => {
    for (const b of [{}, { categoria_id: 7, mes: 13, anio: 2026, monto: 1 }, { categoria_id: 7, mes: 6, anio: 2026, monto: -5 }]) {
      expect((await POST(body(b))).status).toBe(400)
    }
    expect(mp.presupuesto.upsert).not.toHaveBeenCalled()
  })

  it('404 si la categoría no existe', async () => {
    mp.categoria.findUnique.mockResolvedValue(null)
    expect((await POST(body({ categoria_id: 99, mes: 6, anio: 2026, monto: 1000 }))).status).toBe(404)
    expect(mp.presupuesto.upsert).not.toHaveBeenCalled()
  })
})
