import { describe, it, expect } from 'vitest'
import {
  promediosPorCategoria,
  distribuirPresupuestos,
  reajustar,
  parseGenerarBody,
  parseAplicarBody,
  MESES_HISTORICO_DEFAULT,
} from './presupuestos-auto'
import type { PromedioCategoria, Propuesta } from './presupuestos-auto'

const bucket = (id: number | null, nombre: string, total: number) => ({ id, nombre, total_ars: total })

/** Suma de los topes propuestos, para chequear que el reparto cierra. */
const asignadoDe = (p: { filas: { monto: number }[] }) =>
  Math.round(p.filas.reduce((s, f) => s + f.monto, 0) * 100) / 100

const montoDe = (p: { filas: { categoria_id: number; monto: number }[] }, id: number) =>
  p.filas.find(f => f.categoria_id === id)?.monto

describe('promediosPorCategoria', () => {
  it('promedia sobre toda la ventana: un mes sin gasto cuenta como 0', () => {
    const r = promediosPorCategoria([
      [bucket(7, 'Mercados', 1200)],
      [bucket(7, 'Mercados', 800)],
      [], // mes sin gasto en la categoría
    ])

    expect(r).toEqual([{ categoria_id: 7, categoria_nombre: 'Mercados', promedio: 666.67 }])
  })

  it('con average_found promedia sólo los meses en que hubo gasto', () => {
    const r = promediosPorCategoria([
      [bucket(7, 'Mercados', 1200)],
      [bucket(7, 'Mercados', 800)],
      [],
    ], 'average_found')

    expect(r[0].promedio).toBe(1000)
  })

  it('ignora "Sin categoría": no es una categoría a la que ponerle tope', () => {
    const r = promediosPorCategoria([[bucket(null, 'Sin categoría', 5000), bucket(7, 'Mercados', 100)]])
    expect(r.map(f => f.categoria_id)).toEqual([7])
  })

  it('descarta las categorías sin histórico o en negativo: un tope en 0 no es "sin tope"', () => {
    const r = promediosPorCategoria([[bucket(7, 'Mercados', 100), bucket(9, 'Devoluciones', -50), bucket(11, 'Nada', 0)]])
    expect(r.map(f => f.categoria_id)).toEqual([7])
  })

  it('ordena por promedio descendente', () => {
    const r = promediosPorCategoria([[bucket(7, 'Chico', 100), bucket(9, 'Grande', 900), bucket(11, 'Medio', 500)]])
    expect(r.map(f => f.categoria_nombre)).toEqual(['Grande', 'Medio', 'Chico'])
  })

  it('sin meses en la ventana no hay promedios', () => {
    expect(promediosPorCategoria([])).toEqual([])
  })
})

describe('distribuirPresupuestos', () => {
  const promedios: PromedioCategoria[] = [
    { categoria_id: 7, categoria_nombre: 'Mercados', promedio: 1000 },
    { categoria_id: 9, categoria_nombre: 'Servicios', promedio: 500 },
    { categoria_id: 11, categoria_nombre: 'Ocio', promedio: 500 },
  ]

  it('escala los promedios para que entren en ingresos − objetivo', () => {
    const p = distribuirPresupuestos({ objetivo: 1500, ingresos: 3000, promedios })

    expect(p.disponible).toBe(1500)
    expect(p.factor).toBe(0.75)
    expect(montoDe(p, 7)).toBe(750)
    expect(montoDe(p, 9)).toBe(375)
    expect(montoDe(p, 11)).toBe(375)
    expect(p.asignado).toBe(1500)
    expect(p.colchon).toBe(0)
    expect(p.estado).toBe('ok')
  })

  it('capea el factor en 1: el objetivo holgado deja colchón, no infla los topes', () => {
    const p = distribuirPresupuestos({ objetivo: 500, ingresos: 3000, promedios })

    expect(p.factor).toBe(1)
    expect(montoDe(p, 7)).toBe(1000)
    expect(p.asignado).toBe(2000)
    expect(p.colchon).toBe(500)
    expect(p.estado).toBe('holgado')
  })

  it('reserva las fijas a su promedio y recorta sólo las flexibles', () => {
    const conFija: PromedioCategoria[] = [
      { categoria_id: 7, categoria_nombre: 'Mercados', promedio: 1000 },
      { categoria_id: 20, categoria_nombre: 'Alquiler', promedio: 800 },
      { categoria_id: 11, categoria_nombre: 'Ocio', promedio: 200 },
    ]
    const p = distribuirPresupuestos({ objetivo: 500, ingresos: 2000, promedios: conFija, fijadas: [20] })

    expect(montoDe(p, 20)).toBe(800)
    expect(p.filas.find(f => f.categoria_id === 20)?.fijado).toBe(true)
    // Las flexibles se reparten los 700 que quedan (1500 − 800).
    expect(montoDe(p, 7)).toBe(583.33)
    expect(montoDe(p, 11)).toBe(116.67)
    expect(p.asignado).toBe(1500)
    expect(p.estado).toBe('ok')
  })

  it('no propone nada si los gastos fijos solos se pasan del disponible', () => {
    const conFija: PromedioCategoria[] = [
      { categoria_id: 20, categoria_nombre: 'Alquiler', promedio: 2000 },
      { categoria_id: 7, categoria_nombre: 'Mercados', promedio: 500 },
    ]
    const p = distribuirPresupuestos({ objetivo: 500, ingresos: 2000, promedios: conFija, fijadas: [20] })

    expect(p.estado).toBe('imposible')
    expect(p.faltante).toBe(500)
    // Lo fijo queda a la vista; lo flexible en 0, no en negativo.
    expect(montoDe(p, 20)).toBe(2000)
    expect(montoDe(p, 7)).toBe(0)
  })

  it('un objetivo mayor a los ingresos es imposible', () => {
    const p = distribuirPresupuestos({ objetivo: 4000, ingresos: 3000, promedios })
    expect(p.disponible).toBe(-1000)
    expect(p.estado).toBe('imposible')
    expect(p.faltante).toBe(1000)
  })

  it('el residuo del redondeo cierra exacto contra el disponible', () => {
    const tercios: PromedioCategoria[] = [
      { categoria_id: 1, categoria_nombre: 'A', promedio: 100 },
      { categoria_id: 2, categoria_nombre: 'B', promedio: 100 },
      { categoria_id: 3, categoria_nombre: 'C', promedio: 100 },
    ]
    const p = distribuirPresupuestos({ objetivo: 0, ingresos: 100, promedios: tercios })

    // 33.33 × 3 = 99.99: el centavo que falta va a una sola fila, no se pierde.
    expect(asignadoDe(p)).toBe(100)
    expect(p.asignado).toBe(100)
    expect(p.colchon).toBe(0)
  })

  it('sin categorías con histórico no hay nada que repartir', () => {
    const p = distribuirPresupuestos({ objetivo: 500, ingresos: 2000, promedios: [] })
    expect(p.filas).toEqual([])
    expect(p.asignado).toBe(0)
    expect(p.colchon).toBe(1500)
    expect(p.estado).toBe('holgado')
  })

  it('con todas las categorías fijas no se recorta nada', () => {
    const p = distribuirPresupuestos({ objetivo: 500, ingresos: 3000, promedios, fijadas: [7, 9, 11] })
    expect(p.asignado).toBe(2000)
    expect(p.colchon).toBe(500)
    expect(p.factor).toBe(1)
  })
})

describe('reajustar', () => {
  /** Propuesta base: 750 / 375 / 375 sobre un disponible de 1500. */
  const base = (): Propuesta => distribuirPresupuestos({
    objetivo: 1500,
    ingresos: 3000,
    promedios: [
      { categoria_id: 7, categoria_nombre: 'Mercados', promedio: 1000 },
      { categoria_id: 9, categoria_nombre: 'Servicios', promedio: 500 },
      { categoria_id: 11, categoria_nombre: 'Ocio', promedio: 500 },
    ],
  })

  it('subir un tope baja los demás y el objetivo se sigue cumpliendo', () => {
    const p = reajustar(base(), 7, 900)

    expect(montoDe(p, 7)).toBe(900)
    expect(montoDe(p, 9)).toBe(300)
    expect(montoDe(p, 11)).toBe(300)
    expect(p.asignado).toBe(1500)
    expect(p.colchon).toBe(0)
    expect(p.estado).toBe('ok')
    expect(p.no_absorbido).toBe(0)
  })

  it('bajar un tope sube los demás: la compensación va en los dos sentidos', () => {
    const p = reajustar(base(), 7, 450)

    expect(montoDe(p, 9)).toBe(525)
    expect(montoDe(p, 11)).toBe(525)
    expect(p.asignado).toBe(1500)
  })

  it('la categoría tocada queda fijada y un ajuste posterior no la mueve', () => {
    const p1 = reajustar(base(), 7, 900)
    expect(p1.filas.find(f => f.categoria_id === 7)?.fijado).toBe(true)

    const p2 = reajustar(p1, 9, 400)
    // El primer ajuste no se deshace: Mercados sigue en 900.
    expect(montoDe(p2, 7)).toBe(900)
    expect(montoDe(p2, 9)).toBe(400)
    expect(montoDe(p2, 11)).toBe(200)
    expect(p2.asignado).toBe(1500)
  })

  it('las categorías que no se tocaron conservan su proporción entre sí', () => {
    // Bajar Ocio a 100 libera 275, que se reparten proporcional al monto actual: Mercados
    // (750) recibe el doble que Servicios (375), y siguen 2 a 1.
    const p1 = reajustar(base(), 11, 100)
    expect(montoDe(p1, 7)).toBe(933.33)
    expect(montoDe(p1, 9)).toBe(466.67)
    expect(montoDe(p1, 7)! / montoDe(p1, 9)!).toBeCloseTo(2, 4)
    expect(p1.asignado).toBe(1500)

    // Al subir Mercados, la baja cae toda sobre Servicios: Ocio quedó fijado al tocarlo.
    const p2 = reajustar(p1, 7, 1150)
    expect(montoDe(p2, 9)).toBe(250)
    expect(montoDe(p2, 11)).toBe(100)
    expect(p2.asignado).toBe(1500)
  })

  it('no baja de 0 y avisa lo que no se pudo compensar', () => {
    const chica = distribuirPresupuestos({
      objetivo: 0,
      ingresos: 600,
      promedios: [
        { categoria_id: 7, categoria_nombre: 'Mercados', promedio: 500 },
        { categoria_id: 9, categoria_nombre: 'Servicios', promedio: 100 },
      ],
    })

    const p = reajustar(chica, 7, 700)

    expect(montoDe(p, 9)).toBe(0)
    // Faltaron 100 que ninguna categoría pudo absorber.
    expect(p.no_absorbido).toBe(100)
    expect(p.estado).toBe('imposible')
    expect(p.faltante).toBe(100)
    expect(p.asignado).toBe(700)
  })

  it('no toca las categorías fijas al compensar', () => {
    const conFija = distribuirPresupuestos({
      objetivo: 500,
      ingresos: 2000,
      promedios: [
        { categoria_id: 7, categoria_nombre: 'Mercados', promedio: 1000 },
        { categoria_id: 20, categoria_nombre: 'Alquiler', promedio: 800 },
        { categoria_id: 11, categoria_nombre: 'Ocio', promedio: 200 },
      ],
      fijadas: [20],
    })

    const p = reajustar(conFija, 7, 600)

    expect(montoDe(p, 20)).toBe(800)
    expect(montoDe(p, 11)).toBe(100)
    expect(p.asignado).toBe(1500)
  })

  it('el colchón de un objetivo holgado se conserva', () => {
    const holgada = distribuirPresupuestos({
      objetivo: 500,
      ingresos: 3000,
      promedios: [
        { categoria_id: 7, categoria_nombre: 'Mercados', promedio: 1000 },
        { categoria_id: 9, categoria_nombre: 'Servicios', promedio: 1000 },
      ],
    })
    expect(holgada.colchon).toBe(500)

    const p = reajustar(holgada, 7, 1200)
    expect(montoDe(p, 9)).toBe(800)
    expect(p.colchon).toBe(500)
    expect(p.estado).toBe('holgado')
  })

  it('un monto negativo se toma como 0', () => {
    const p = reajustar(base(), 7, -100)
    expect(montoDe(p, 7)).toBe(0)
    expect(p.asignado).toBe(1500)
  })

  it('una categoría que no está en la propuesta no cambia nada', () => {
    const original = base()
    const p = reajustar(original, 999, 100)
    expect(p.filas).toEqual(original.filas)
  })

  it('no muta la propuesta original', () => {
    const original = base()
    reajustar(original, 7, 900)
    expect(montoDe(original, 7)).toBe(750)
    expect(original.filas.find(f => f.categoria_id === 7)?.fijado).toBe(false)
  })
})

describe('parseGenerarBody', () => {
  const ok = { mes: 6, anio: 2026, objetivo: 50000, ingresos_esperados: 200000 }

  it('normaliza y aplica los defaults', () => {
    expect(parseGenerarBody(ok)).toEqual({
      mes: 6,
      anio: 2026,
      base: 'devengado',
      objetivo: 50000,
      ingresosEsperados: 200000,
      mesesHistorico: MESES_HISTORICO_DEFAULT,
      fijadas: [],
    })
  })

  it('toma la base y el histórico cuando vienen, y deduplica las fijas', () => {
    const r = parseGenerarBody({ ...ok, base: 'caja', meses_historico: 6, categorias_fijas: [3, 3, 5] })
    expect(r).toMatchObject({ base: 'caja', mesesHistorico: 6, fijadas: [3, 5] })
  })

  it('una base desconocida cae a devengado en vez de romper', () => {
    expect(parseGenerarBody({ ...ok, base: 'otra' })?.base).toBe('devengado')
  })

  it('acepta objetivo 0 — gastar todo lo que entra es un plan válido', () => {
    expect(parseGenerarBody({ ...ok, objetivo: 0 })?.objetivo).toBe(0)
  })

  it('rechaza lo que no se puede repartir', () => {
    const malos = [
      null,
      {},
      { ...ok, mes: 13 },
      { ...ok, anio: 1800 },
      { ...ok, objetivo: -1 },
      { ...ok, objetivo: 'mucho' },
      { ...ok, ingresos_esperados: -1 },
      // `Number(null)` es 0: no puede colarse como "no entra plata".
      { ...ok, ingresos_esperados: null },
      { ...ok, objetivo: null },
      { ...ok, meses_historico: 0 },
      { ...ok, meses_historico: 25 },
      { ...ok, meses_historico: 1.5 },
      { ...ok, categorias_fijas: 'todas' },
      { ...ok, categorias_fijas: [0] },
      { ...ok, categorias_fijas: [1.5] },
    ]
    for (const b of malos) expect(parseGenerarBody(b)).toBeNull()
  })
})

describe('parseAplicarBody', () => {
  const ok = {
    mes: 6,
    anio: 2026,
    objetivo: 50000,
    ingresos_esperados: 200000,
    filas: [{ categoria_id: 7, monto: 1000, fijado: true }, { categoria_id: 9, monto: 0 }],
  }

  it('normaliza las filas a camelCase, con fijado explícito', () => {
    expect(parseAplicarBody(ok)?.filas).toEqual([
      { categoriaId: 7, monto: 1000, fijado: true },
      { categoriaId: 9, monto: 0, fijado: false },
    ])
  })

  it('deduplica por categoría quedándose con la última', () => {
    const r = parseAplicarBody({
      ...ok,
      filas: [{ categoria_id: 7, monto: 100 }, { categoria_id: 7, monto: 300 }],
    })
    expect(r?.filas).toEqual([{ categoriaId: 7, monto: 300, fijado: false }])
  })

  it('hereda la validación de los supuestos', () => {
    expect(parseAplicarBody({ ...ok, objetivo: -1 })).toBeNull()
  })

  it('rechaza filas vacías o inválidas', () => {
    for (const filas of [[], undefined, 'nada', [{ categoria_id: 0, monto: 1 }], [{ categoria_id: 7, monto: -1 }]]) {
      expect(parseAplicarBody({ ...ok, filas })).toBeNull()
    }
  })
})
