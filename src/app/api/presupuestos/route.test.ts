import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    presupuesto: { findMany: vi.fn(), upsert: vi.fn() },
    gasto: { findMany: vi.fn() },
    categoria: { findUnique: vi.fn() },
    objetivoAhorro: { findUnique: vi.fn() },
    ingreso: { findMany: vi.fn() },
  },
}))

import { GET, POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const url = (qs: string) => ({ url: `http://localhost/api/presupuestos?${qs}` }) as any
const body = (b: any) => ({ json: async () => b }) as any

/** Fila cruda de gasto con lo mínimo que necesita la agregación de las dos bases. */
function rawGasto(over: Record<string, any> = {}) {
  return {
    conceptoId: 1,
    concepto: { id: 1, nombre: 'Super' },
    totalMoneda: 1000,
    tipoCambio: 1,
    confirmado: true,
    esTarjeta: false,
    tipoPago: 'D',
    categoriaId: null,
    categoria: null,
    etiquetas: [],
    items: [],
    mes: 6,
    anio: 2026,
    ...over,
  }
}

function rawItem(over: Record<string, any> = {}) {
  return {
    conceptoId: 1,
    concepto: { id: 1, nombre: 'Consumo' },
    monto: 100,
    incluyeEnTotal: true,
    categoriaId: null,
    categoria: null,
    etiquetas: [],
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mp.presupuesto.findMany.mockResolvedValue([])
  mp.gasto.findMany.mockResolvedValue([])
  mp.objetivoAhorro.findUnique.mockResolvedValue(null)
  mp.ingreso.findMany.mockResolvedValue([])
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

  it('trae todos los gastos del mes: cada base se queda con los suyos', async () => {
    await GET(url('mes=6&anio=2026'))
    const arg = mp.gasto.findMany.mock.calls[0][0]
    expect(arg.where).toEqual({ mes: 6, anio: 2026 })
    // La base caja desglosa el resumen por sub-ítem y necesita su categoría.
    expect(arg.include.items).toEqual({ include: { categoria: true, etiquetas: true, concepto: true } })
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

describe('GET /api/presupuestos — las dos bases', () => {
  const comida = { categoriaId: 7, categoria: { id: 7, nombre: 'Comida' } }

  it('el consumo de crédito cuenta en devengado; el pago del resumen, en caja', async () => {
    mp.presupuesto.findMany.mockResolvedValue([
      { id: 1, categoriaId: 7, mes: 6, anio: 2026, monto: 10000, categoria: { nombre: 'Comida' } },
    ])
    mp.gasto.findMany.mockResolvedValue([
      // Consumido con la tarjeta este mes: devengado sí, caja todavía no.
      rawGasto({ ...comida, tipoPago: 'C', totalMoneda: 4000 }),
      // Resumen pagado este mes: caja sí (desglosado por sub-ítem), devengado no.
      rawGasto({ esTarjeta: true, tipoPago: 'D', totalMoneda: 3000, items: [rawItem({ monto: 3000, ...comida })] }),
    ])

    const data = await (await GET(url('mes=6&anio=2026'))).json()

    expect(data.ejecucion[0]).toMatchObject({ categoria_id: 7, gastado: 4000 })
    expect(data.ejecucion_caja[0]).toMatchObject({ categoria_id: 7, gastado: 3000 })
    // El tope es el mismo en las dos: lo que cambia es contra qué se compara.
    expect(data.ejecucion_caja[0].monto).toBe(10000)
    expect(data.totales_caja).toMatchObject({ presupuestado: 10000, gastado: 3000 })
    expect(data.no_atribuido_caja).toBe(0)
  })

  it('informa el débito que ninguna categoría se llevó', async () => {
    mp.gasto.findMany.mockResolvedValue([
      rawGasto({ esTarjeta: true, tipoPago: 'D', totalMoneda: 5000, items: [rawItem({ monto: 3200, ...comida })] }),
    ])
    const data = await (await GET(url('mes=6&anio=2026'))).json()
    expect(data.no_atribuido_caja).toBe(1800)
  })
})

describe('GET /api/presupuestos — objetivo de ahorro', () => {
  it('sin objetivo guardado devuelve null: los topes se cargaron a mano', async () => {
    const data = await (await GET(url('mes=6&anio=2026'))).json()
    expect(data.objetivo).toBeNull()
  })

  it('mapea el objetivo guardado a snake_case', async () => {
    mp.objetivoAhorro.findUnique.mockResolvedValue({
      id: 1, mes: 6, anio: 2026, monto: 50000, ingresosEsperados: 200000, base: 'caja', mesesHistorico: 6,
    })

    const data = await (await GET(url('mes=6&anio=2026'))).json()

    expect(mp.objetivoAhorro.findUnique.mock.calls[0][0].where).toEqual({ mes_anio: { mes: 6, anio: 2026 } })
    expect(data.objetivo).toEqual({
      id: 1, mes: 6, anio: 2026, monto: 50000, ingresos_esperados: 200000, base: 'caja', meses_historico: 6,
    })
  })

  it('sugiere los ingresos ya cargados del mes cuando los hay', async () => {
    mp.ingreso.findMany
      .mockResolvedValueOnce([{ montoMoneda: 500000, tipoCambio: 1 }])
      .mockResolvedValueOnce([{ montoMoneda: 1, tipoCambio: 1 }])

    const data = await (await GET(url('mes=6&anio=2026'))).json()
    expect(data.ingresos_mes).toBe(500000)
    expect(data.ingresos_sugeridos).toBe(500000)
  })

  it('sin ingresos cargados sugiere el promedio de los meses previos', async () => {
    mp.ingreso.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { montoMoneda: 300000, tipoCambio: 1 },
        { montoMoneda: 300000, tipoCambio: 1 },
        { montoMoneda: 200000, tipoCambio: 1 },
      ])

    const data = await (await GET(url('mes=6&anio=2026'))).json()

    // Ventana de 3 meses: 800000 / 3.
    expect(data.ingresos_mes).toBe(0)
    expect(data.ingresos_sugeridos).toBe(266666.67)
    expect(mp.ingreso.findMany.mock.calls[1][0].where).toEqual({
      OR: [{ mes: 3, anio: 2026 }, { mes: 4, anio: 2026 }, { mes: 5, anio: 2026 }],
    })
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
