import { describe, it, expect } from 'vitest'
import { enumerateMonths, computeReportes, computeReporteSubitems } from './reportes-compute'

function gasto(overrides: Record<string, any> = {}) {
  return {
    conceptoId: 1,
    concepto: { id: 1, nombre: 'Internet' },
    totalMoneda: 1000,
    tipoCambio: 1,
    confirmado: true,
    categoriaId: null,
    categoria: null,
    etiquetas: [],
    items: [],
    mes: 6,
    anio: 2026,
    ...overrides,
  }
}

describe('enumerateMonths', () => {
  it('enumera un rango dentro del mismo año, cronológico e inclusive', () => {
    expect(enumerateMonths(4, 2026, 7, 2026)).toEqual([
      { mes: 4, anio: 2026 },
      { mes: 5, anio: 2026 },
      { mes: 6, anio: 2026 },
      { mes: 7, anio: 2026 },
    ])
  })

  it('maneja el wraparound de año', () => {
    expect(enumerateMonths(11, 2025, 2, 2026)).toEqual([
      { mes: 11, anio: 2025 },
      { mes: 12, anio: 2025 },
      { mes: 1, anio: 2026 },
      { mes: 2, anio: 2026 },
    ])
  })

  it('endereza un rango invertido', () => {
    expect(enumerateMonths(7, 2026, 4, 2026)).toEqual([
      { mes: 4, anio: 2026 },
      { mes: 5, anio: 2026 },
      { mes: 6, anio: 2026 },
      { mes: 7, anio: 2026 },
    ])
  })

  it('un solo mes cuando desde === hasta', () => {
    expect(enumerateMonths(6, 2026, 6, 2026)).toEqual([{ mes: 6, anio: 2026 }])
  })

  it('acota a 60 meses recortando desde el inicio', () => {
    const r = enumerateMonths(1, 2000, 12, 2010) // 132 meses
    expect(r).toHaveLength(60)
    expect(r[r.length - 1]).toEqual({ mes: 12, anio: 2010 })
  })
})

describe('computeReportes', () => {
  const months = enumerateMonths(5, 2026, 7, 2026)

  it('suma el total ARS y calcula el promedio mensual sobre la cantidad de meses', () => {
    const r = computeReportes(
      [gasto({ mes: 5, totalMoneda: 100 }), gasto({ mes: 6, totalMoneda: 200 }), gasto({ mes: 7, totalMoneda: 300 })],
      months,
    )
    expect(r.kpis.total).toBe(600)
    expect(r.kpis.meses).toBe(3)
    expect(r.kpis.promedio_mensual).toBe(200)
    expect(r.kpis.cantidad_gastos).toBe(3)
  })

  it('usa tipoCambio para el total ARS', () => {
    const r = computeReportes([gasto({ totalMoneda: 100, tipoCambio: 1500 })], months)
    expect(r.kpis.total).toBe(150000)
  })

  it('por_categoria es partición: cada gasto cuenta una vez en su categoría única (suma = total)', () => {
    const r = computeReportes(
      [
        gasto({ totalMoneda: 100, categoriaId: 1, categoria: { id: 1, nombre: 'Auto' } }),
        gasto({ totalMoneda: 300, categoriaId: 2, categoria: { id: 2, nombre: 'Super' } }),
        gasto({ totalMoneda: 200, categoriaId: 1, categoria: { id: 1, nombre: 'Auto' } }),
      ],
      months,
    )
    expect(r.por_categoria.find((c) => c.id === 1)?.total_ars).toBe(300)
    expect(r.por_categoria.find((c) => c.id === 2)?.total_ars).toBe(300)
    const sumaCategorias = r.por_categoria.reduce((s, c) => s + c.total_ars, 0)
    expect(sumaCategorias).toBe(r.kpis.total)
  })

  it('gastos sin categoría van a "Sin categoría" (id null)', () => {
    const r = computeReportes([gasto({ totalMoneda: 500 })], months)
    const sin = r.por_categoria.find((c) => c.id === null)
    expect(sin?.nombre).toBe('Sin categoría')
    expect(sin?.total_ars).toBe(500)
  })

  it('por_etiqueta es cobertura: monto completo a cada etiqueta (puede superar el total)', () => {
    const r = computeReportes(
      [gasto({ totalMoneda: 1000, etiquetas: [{ id: 1, nombre: 'Viaje' }, { id: 2, nombre: 'Deducible' }] })],
      months,
    )
    expect(r.por_etiqueta.find((e) => e.id === 1)?.total_ars).toBe(1000)
    expect(r.por_etiqueta.find((e) => e.id === 2)?.total_ars).toBe(1000)
    // el KPI cuenta el gasto una sola vez, aunque las etiquetas se solapen
    expect(r.kpis.total).toBe(1000)
  })

  it('gastos sin etiqueta van a "Sin etiqueta" (id null)', () => {
    const r = computeReportes([gasto({ totalMoneda: 400, etiquetas: [] })], months)
    const sin = r.por_etiqueta.find((e) => e.id === null)
    expect(sin?.nombre).toBe('Sin etiqueta')
    expect(sin?.total_ars).toBe(400)
  })

  it('agrega por mes y deja en 0 los meses sin gastos', () => {
    const r = computeReportes([gasto({ mes: 5, totalMoneda: 100 }), gasto({ mes: 7, totalMoneda: 300 })], months)
    expect(r.por_mes.map((m) => m.total_ars)).toEqual([100, 0, 300])
    expect(r.por_mes[0].label).toBe('May 26')
  })

  it('rankea conceptos desc y respeta el límite topConceptos', () => {
    const gastos = [
      gasto({ conceptoId: 1, concepto: { id: 1, nombre: 'A' }, totalMoneda: 100 }),
      gasto({ conceptoId: 2, concepto: { id: 2, nombre: 'B' }, totalMoneda: 300 }),
      gasto({ conceptoId: 3, concepto: { id: 3, nombre: 'C' }, totalMoneda: 200 }),
    ]
    const r = computeReportes(gastos, months, { topConceptos: 2 })
    expect(r.top_conceptos.map((c) => c.nombre)).toEqual(['B', 'C'])
  })

  it('suma el mismo concepto a través de meses', () => {
    const r = computeReportes(
      [gasto({ mes: 5, totalMoneda: 100 }), gasto({ mes: 6, totalMoneda: 150 })],
      months,
    )
    expect(r.top_conceptos).toHaveLength(1)
    expect(r.top_conceptos[0].total_ars).toBe(250)
  })

  it('agrupa por tarjeta (con "Sin tarjeta" para tarjetaId null) desc por total', () => {
    const r = computeReportes(
      [
        gasto({ tarjetaId: 1, tarjeta: { id: 1, nombre: 'Visa' }, totalMoneda: 100 }),
        gasto({ tarjetaId: 1, tarjeta: { id: 1, nombre: 'Visa' }, totalMoneda: 200 }),
        gasto({ tarjetaId: null, tarjeta: null, totalMoneda: 500 }),
      ],
      months,
    )
    expect(r.por_tarjeta).toEqual([
      { id: null, nombre: 'Sin tarjeta', total_ars: 500 },
      { id: 1, nombre: 'Visa', total_ars: 300 },
    ])
  })

  it('agrupa por tipo de pago con nombres legibles', () => {
    const r = computeReportes(
      [
        gasto({ tipoPago: 'C', totalMoneda: 300 }),
        gasto({ tipoPago: 'D', totalMoneda: 100 }),
        gasto({ tipoPago: 'C', totalMoneda: 50 }),
      ],
      months,
    )
    expect(r.por_tipo_pago).toEqual([
      { tipo: 'C', nombre: 'Crédito', total_ars: 350 },
      { tipo: 'D', nombre: 'Débito', total_ars: 100 },
    ])
  })

  it('gasto no confirmado con sub-items usa la suma de items incluidos en total', () => {
    const r = computeReportes(
      [gasto({
        confirmado: false,
        totalMoneda: 9999,
        items: [
          { monto: 100, incluyeEnTotal: true },
          { monto: 50, incluyeEnTotal: true },
          { monto: 999, incluyeEnTotal: false },
        ],
      })],
      months,
    )
    expect(r.kpis.total).toBe(150)
  })
})

describe('computeReporteSubitems', () => {
  const months = enumerateMonths(6, 2026, 6, 2026)

  it('desglosa por la categoría (única) y monto de cada sub-item incluido en total', () => {
    const r = computeReporteSubitems(
      [gasto({
        totalMoneda: 9999, // se ignora: se usan los sub-items
        categoriaId: 9,
        categoria: { id: 9, nombre: 'Genérica' },
        items: [
          { monto: 60, incluyeEnTotal: true, conceptoId: 11, concepto: { id: 11, nombre: 'Comida' }, categoriaId: 1, categoria: { id: 1, nombre: 'Super' }, etiquetas: [] },
          { monto: 40, incluyeEnTotal: true, conceptoId: 12, concepto: { id: 12, nombre: 'Limpieza' }, categoriaId: 2, categoria: { id: 2, nombre: 'Hogar' }, etiquetas: [] },
          { monto: 999, incluyeEnTotal: false, conceptoId: 13, concepto: { id: 13, nombre: 'X' }, categoriaId: null, categoria: null, etiquetas: [] },
        ],
      })],
      months,
    )
    expect(r.kpis.total).toBe(100)
    expect(r.por_categoria.find((c) => c.id === 1)?.total_ars).toBe(60)
    expect(r.por_categoria.find((c) => c.id === 2)?.total_ars).toBe(40)
    // la categoría del gasto padre NO se usa cuando hay sub-items
    expect(r.por_categoria.find((c) => c.id === 9)).toBeUndefined()
    expect(r.top_conceptos.map((c) => c.nombre).sort()).toEqual(['Comida', 'Limpieza'])
  })

  it('desglosa las etiquetas de cada sub-item (cobertura)', () => {
    const r = computeReporteSubitems(
      [gasto({
        items: [
          { monto: 60, incluyeEnTotal: true, conceptoId: 1, concepto: { id: 1, nombre: 'A' }, categoriaId: null, categoria: null, etiquetas: [{ id: 7, nombre: 'Viaje' }] },
          { monto: 40, incluyeEnTotal: true, conceptoId: 2, concepto: { id: 2, nombre: 'B' }, categoriaId: null, categoria: null, etiquetas: [{ id: 7, nombre: 'Viaje' }] },
        ],
      })],
      months,
    )
    expect(r.por_etiqueta.find((e) => e.id === 7)?.total_ars).toBe(100)
  })

  it('cae al nivel gasto cuando no hay sub-items incluidos en total', () => {
    const r = computeReporteSubitems(
      [gasto({ totalMoneda: 500, categoriaId: 5, categoria: { id: 5, nombre: 'Auto' }, items: [] })],
      months,
    )
    expect(r.kpis.total).toBe(500)
    expect(r.por_categoria.find((c) => c.id === 5)?.total_ars).toBe(500)
  })

  it('sub-item sin categoría cae en "Sin categoría"', () => {
    const r = computeReporteSubitems(
      [gasto({ items: [{ monto: 80, incluyeEnTotal: true, conceptoId: 1, concepto: { id: 1, nombre: 'A' }, categoriaId: null, categoria: null, etiquetas: [] }] })],
      months,
    )
    expect(r.por_categoria.find((c) => c.id === null)?.total_ars).toBe(80)
  })

  it('cantidad_gastos cuenta filas de gasto, no unidades', () => {
    const r = computeReporteSubitems(
      [gasto({ items: [
        { monto: 10, incluyeEnTotal: true, conceptoId: 1, concepto: { id: 1, nombre: 'A' }, categoriaId: null, categoria: null, etiquetas: [] },
        { monto: 20, incluyeEnTotal: true, conceptoId: 2, concepto: { id: 2, nombre: 'B' }, categoriaId: null, categoria: null, etiquetas: [] },
      ] })],
      months,
    )
    expect(r.kpis.cantidad_gastos).toBe(1)
    expect(r.kpis.total).toBe(30)
  })

  it('los sub-items de un resumen de tarjeta (esTarjeta) se cuentan como crédito', () => {
    const r = computeReporteSubitems(
      [gasto({
        esTarjeta: true,
        tipoPago: 'D', // el contenedor arranca como débito por default; se ignora para sus sub-items
        tarjetaId: 3,
        tarjeta: { id: 3, nombre: 'Visa' },
        items: [
          { monto: 700, incluyeEnTotal: true, conceptoId: 1, concepto: { id: 1, nombre: 'Super' }, categoriaId: 1, categoria: { id: 1, nombre: 'Comida' }, etiquetas: [] },
          { monto: 300, incluyeEnTotal: true, conceptoId: 2, concepto: { id: 2, nombre: 'Nafta' }, categoriaId: 2, categoria: { id: 2, nombre: 'Auto' }, etiquetas: [] },
        ],
      })],
      months,
    )
    // Todo el consumo de la tarjeta cae en crédito, no en débito.
    expect(r.por_tipo_pago).toEqual([{ tipo: 'C', nombre: 'Crédito', total_ars: 1000 }])
    // Y bajo la tarjeta correcta, desglosado por la categoría de cada sub-item.
    expect(r.por_tarjeta).toEqual([{ id: 3, nombre: 'Visa', total_ars: 1000 }])
    expect(r.por_categoria.find((c) => c.id === 1)?.total_ars).toBe(700)
    expect(r.por_categoria.find((c) => c.id === 2)?.total_ars).toBe(300)
  })

  it('un gasto individual de crédito (no esTarjeta) mantiene su tipo de pago', () => {
    const r = computeReporteSubitems(
      [gasto({ tipoPago: 'C', totalMoneda: 500, items: [] })],
      months,
    )
    expect(r.por_tipo_pago).toEqual([{ tipo: 'C', nombre: 'Crédito', total_ars: 500 }])
  })

  it('usa el monto del sub-item tal cual, sin escalar al total del gasto confirmado', () => {
    const r = computeReporteSubitems(
      [gasto({
        esTarjeta: true,
        confirmado: true,
        totalMoneda: 1000, // difiere de la suma de sub-items (1200): posible error de carga, NO se enmascara
        tipoCambio: 1,
        tarjetaId: 3,
        tarjeta: { id: 3, nombre: 'Visa' },
        items: [
          { monto: 800, incluyeEnTotal: true, conceptoId: 1, concepto: { id: 1, nombre: 'A' }, categoriaId: 1, categoria: { id: 1, nombre: 'Comida' }, etiquetas: [] },
          { monto: 400, incluyeEnTotal: true, conceptoId: 2, concepto: { id: 2, nombre: 'B' }, categoriaId: 2, categoria: { id: 2, nombre: 'Auto' }, etiquetas: [] },
        ],
      })],
      months,
    )
    // El total es la suma cruda de sub-items (1200), no el totalMoneda (1000).
    expect(r.kpis.total).toBe(1200)
    expect(r.por_categoria.find((c) => c.id === 1)?.total_ars).toBe(800)
    expect(r.por_categoria.find((c) => c.id === 2)?.total_ars).toBe(400)
    expect(r.por_tipo_pago).toEqual([{ tipo: 'C', nombre: 'Crédito', total_ars: 1200 }])
  })
})

describe('computeReporteSubitems — filtros a nivel sub-ítem', () => {
  const months = enumerateMonths(6, 2026, 6, 2026)

  // Resumen de tarjeta con categoría propia ("Tarjeta crédito") y sub-items etiquetados.
  const resumenTarjeta = () => gasto({
    esTarjeta: true,
    categoriaId: 9,
    categoria: { id: 9, nombre: 'Tarjeta crédito' },
    etiquetas: [],
    tarjetaId: 3,
    tarjeta: { id: 3, nombre: 'Visa' },
    items: [
      { monto: 700, incluyeEnTotal: true, conceptoId: 11, concepto: { id: 11, nombre: 'ABL' }, categoriaId: 1, categoria: { id: 1, nombre: 'Servicios' }, etiquetas: [{ id: 4, nombre: 'Impuesto' }] },
      { monto: 300, incluyeEnTotal: true, conceptoId: 12, concepto: { id: 12, nombre: 'Super' }, categoriaId: 2, categoria: { id: 2, nombre: 'Comida' }, etiquetas: [] },
    ],
  })

  it('filtra por la etiqueta del sub-ítem, aunque el gasto padre no la tenga', () => {
    const r = computeReporteSubitems([resumenTarjeta()], months, { filtros: { etiquetaIds: [4] } })
    expect(r.kpis.total).toBe(700)
    expect(r.por_etiqueta).toEqual([{ id: 4, nombre: 'Impuesto', total_ars: 700 }])
  })

  it('combina categoría del padre + etiqueta del sub-ítem (el caso reportado)', () => {
    const r = computeReporteSubitems(
      [resumenTarjeta()],
      months,
      { filtros: { categoriaIds: [9], etiquetaIds: [4] } },
    )
    // La categoría "Tarjeta crédito" es del contenedor: el sub-ítem la hereda y sobrevive.
    expect(r.kpis.total).toBe(700)
    expect(r.kpis.cantidad_gastos).toBe(1)
  })

  it('la categoría del sub-ítem también matchea (no sólo la heredada)', () => {
    const r = computeReporteSubitems([resumenTarjeta()], months, { filtros: { categoriaIds: [2] } })
    expect(r.kpis.total).toBe(300)
    expect(r.por_categoria).toEqual([{ id: 2, nombre: 'Comida', total_ars: 300 }])
  })

  it('descarta los sub-ítems que no matchean aunque el gasto padre sí matchee', () => {
    const r = computeReporteSubitems([resumenTarjeta()], months, { filtros: { conceptoIds: [11] } })
    expect(r.kpis.total).toBe(700)
    expect(r.top_conceptos).toEqual([{ concepto_id: 11, nombre: 'ABL', total_ars: 700 }])
  })

  it('entre dimensiones distintas el filtro es AND', () => {
    const r = computeReporteSubitems(
      [resumenTarjeta()],
      months,
      { filtros: { categoriaIds: [2], etiquetaIds: [4] } },
    )
    // El sub-ítem de categoría 2 no tiene la etiqueta 4; el de la etiqueta 4 es categoría 1.
    expect(r.kpis.total).toBe(0)
    expect(r.kpis.cantidad_gastos).toBe(0)
  })

  it('el fallback a nivel gasto se filtra por las dimensiones del gasto', () => {
    const gastos = [
      gasto({ totalMoneda: 500, categoriaId: 5, categoria: { id: 5, nombre: 'Auto' }, items: [] }),
      gasto({ totalMoneda: 200, categoriaId: 6, categoria: { id: 6, nombre: 'Otro' }, items: [] }),
    ]
    const r = computeReporteSubitems(gastos, months, { filtros: { categoriaIds: [5] } })
    expect(r.kpis.total).toBe(500)
    expect(r.kpis.cantidad_gastos).toBe(1)
  })

  it('cantidad_gastos cuenta sólo los gastos con unidades sobrevivientes', () => {
    const gastos = [resumenTarjeta(), gasto({ totalMoneda: 100, items: [] })]
    const r = computeReporteSubitems(gastos, months, { filtros: { etiquetaIds: [4] } })
    expect(r.kpis.cantidad_gastos).toBe(1)
  })

  it('sin filtros no descarta nada', () => {
    const r = computeReporteSubitems([resumenTarjeta()], months, { filtros: {} })
    expect(r.kpis.total).toBe(1000)
  })
})

describe('computeReportes — por_casa', () => {
  const MESES = [{ mes: 6, anio: 2026 }]

  it('particiona el total por casa', () => {
    const r = computeReportes([
      gasto({ casaId: 1, casa: { nombre: 'Casa' }, totalMoneda: 1000 }),
      gasto({ casaId: 1, casa: { nombre: 'Casa' }, totalMoneda: 500 }),
      gasto({ casaId: 2, casa: { nombre: 'Depto' }, totalMoneda: 300 }),
    ], MESES)

    expect(r.por_casa).toEqual([
      { id: 1, nombre: 'Casa', total_ars: 1500 },
      { id: 2, nombre: 'Depto', total_ars: 300 },
    ])
  })

  it('la suma de por_casa es el total (es partición, no cobertura)', () => {
    const r = computeReportes([
      gasto({ casaId: 1, casa: { nombre: 'Casa' }, totalMoneda: 1000 }),
      gasto({ casaId: 2, casa: { nombre: 'Depto' }, totalMoneda: 300 }),
    ], MESES)
    expect(r.por_casa.reduce((s, c) => s + c.total_ars, 0)).toBe(r.kpis.total)
  })

  it('ordena de mayor a menor', () => {
    const r = computeReportes([
      gasto({ casaId: 1, casa: { nombre: 'Casa' }, totalMoneda: 100 }),
      gasto({ casaId: 2, casa: { nombre: 'Depto' }, totalMoneda: 900 }),
    ], MESES)
    expect(r.por_casa.map(c => c.nombre)).toEqual(['Depto', 'Casa'])
  })

  it('un gasto sin casa cae en "Sin casa"', () => {
    const r = computeReportes([gasto({ casaId: null, casa: null, totalMoneda: 100 })], MESES)
    expect(r.por_casa).toEqual([{ id: null, nombre: 'Sin casa', total_ars: 100 }])
  })

  it('en el desglose por sub-ítems la casa es la del gasto padre', () => {
    const r = computeReporteSubitems([
      gasto({
        casaId: 1, casa: { nombre: 'Casa' }, totalMoneda: 1000,
        items: [
          { conceptoId: 5, concepto: { nombre: 'A' }, monto: 600, incluyeEnTotal: true, categoriaId: null, categoria: null, etiquetas: [] },
          { conceptoId: 6, concepto: { nombre: 'B' }, monto: 400, incluyeEnTotal: true, categoriaId: null, categoria: null, etiquetas: [] },
        ],
      }),
    ], MESES)
    expect(r.por_casa).toEqual([{ id: 1, nombre: 'Casa', total_ars: 1000 }])
  })
})

describe('computeReportes — comparación con el período anterior', () => {
  const MESES = [{ mes: 6, anio: 2026 }]

  it('sin totalPrevio los KPIs de comparación son null', () => {
    const r = computeReportes([gasto({ totalMoneda: 1000 })], MESES)
    expect(r.kpis.total_previo).toBeNull()
    expect(r.kpis.variacion_pct).toBeNull()
  })

  it('calcula la variación porcentual', () => {
    const r = computeReportes([gasto({ totalMoneda: 1500 })], MESES, { totalPrevio: 1000 })
    expect(r.kpis.total_previo).toBe(1000)
    expect(r.kpis.variacion_pct).toBe(50)
  })

  it('la baja da negativo', () => {
    const r = computeReportes([gasto({ totalMoneda: 800 })], MESES, { totalPrevio: 1000 })
    expect(r.kpis.variacion_pct).toBe(-20)
  })

  it('un período previo en cero no divide por cero', () => {
    const r = computeReportes([gasto({ totalMoneda: 1000 })], MESES, { totalPrevio: 0 })
    expect(r.kpis.total_previo).toBe(0)
    expect(r.kpis.variacion_pct).toBeNull()
  })

  it('usa el valor absoluto del previo, así un previo negativo no invierte el signo', () => {
    const r = computeReportes([gasto({ totalMoneda: 500 })], MESES, { totalPrevio: -1000 })
    expect(r.kpis.variacion_pct).toBe(150)
  })

  it('sin cambios da 0', () => {
    const r = computeReportes([gasto({ totalMoneda: 1000 })], MESES, { totalPrevio: 1000 })
    expect(r.kpis.variacion_pct).toBe(0)
  })
})
