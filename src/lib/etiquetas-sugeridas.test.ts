import { describe, it, expect } from 'vitest'
import {
  computeSugerencias,
  etiquetasSugeridas,
  origenEtiqueta,
  parseReglasBody,
  reglasDeCategoria,
  MIN_CATEGORIAS_TRANSVERSAL,
  type ReglaEtiqueta,
  type UsoEtiqueta,
} from './etiquetas-sugeridas'

/** Atajo para armar filas de uso: `uso(etiquetaId, categoriaId, veces)`. */
const uso = (etiquetaId: number, categoriaId: number | null, veces = 1): UsoEtiqueta[] =>
  Array.from({ length: veces }, () => ({ etiquetaId, categoriaId }))

describe('computeSugerencias', () => {
  it('agrupa las etiquetas por la categoría con la que se usaron', () => {
    const s = computeSugerencias([...uso(1, 10), ...uso(2, 10), ...uso(3, 20)])
    expect(s.por_categoria).toEqual({ '10': [1, 2], '20': [3] })
  })

  it('ordena cada categoría por uso descendente', () => {
    const s = computeSugerencias([...uso(1, 10, 2), ...uso(2, 10, 5), ...uso(3, 10, 3)])
    expect(s.por_categoria['10']).toEqual([2, 3, 1])
  })

  it('a igual uso ordena por id, para que el dropdown no se reordene entre cargas', () => {
    const s = computeSugerencias([...uso(7, 10), ...uso(3, 10), ...uso(5, 10)])
    expect(s.por_categoria['10']).toEqual([3, 5, 7])
  })

  it('marca transversal a la etiqueta que cruza el mínimo de categorías', () => {
    const s = computeSugerencias([...uso(1, 10), ...uso(1, 20), ...uso(1, 30)], 3)
    expect(s.transversales).toEqual([1])
  })

  it('no marca transversal a la que se queda un paso abajo del mínimo', () => {
    const s = computeSugerencias([...uso(1, 10), ...uso(1, 20)], 3)
    expect(s.transversales).toEqual([])
  })

  it('muchos usos en una sola categoría no la hacen transversal', () => {
    // El caso `PedidosYa` invertido: 318 usos no importan si son todos de `Delivery`.
    const s = computeSugerencias(uso(1, 10, 318), 3)
    expect(s.transversales).toEqual([])
    expect(s.por_categoria['10']).toEqual([1])
  })

  it('ordena las transversales por cantidad de categorías y desempata por uso', () => {
    const usos = [
      ...uso(1, 10), ...uso(1, 20), ...uso(1, 30),               // 3 cats, 3 usos
      ...uso(2, 10), ...uso(2, 20), ...uso(2, 30), ...uso(2, 40), // 4 cats, 4 usos
      ...uso(3, 10), ...uso(3, 20), ...uso(3, 30, 9),            // 3 cats, 11 usos
    ]
    expect(computeSugerencias(usos, 3).transversales).toEqual([2, 3, 1])
  })

  it('los usos sin categoría no asocian la etiqueta a ninguna ni la hacen transversal', () => {
    const s = computeSugerencias([...uso(1, null, 50), ...uso(1, 10)], 3)
    expect(s.transversales).toEqual([])
    expect(s.por_categoria).toEqual({ '10': [1] })
  })

  it('los usos sin categoría sí cuentan para desempatar transversales', () => {
    const usos = [
      ...uso(1, 10), ...uso(1, 20), ...uso(1, 30),
      ...uso(2, 10), ...uso(2, 20), ...uso(2, 30), ...uso(2, null, 10),
    ]
    expect(computeSugerencias(usos, 3).transversales).toEqual([2, 1])
  })

  it('sin usos devuelve un payload vacío, no null', () => {
    expect(computeSugerencias([])).toEqual({ transversales: [], por_categoria: {}, reglas: [] })
  })

  it('pasa las reglas al payload tal como vinieron', () => {
    const reglas = [{ categoria_id: 10, etiqueta_id: 5, modo: 'fijar' as const }]
    expect(computeSugerencias([], 3, reglas).reglas).toEqual(reglas)
  })

  it('ignora filas con etiquetaId no entero', () => {
    const s = computeSugerencias([{ etiquetaId: NaN, categoriaId: 10 }, ...uso(1, 10)])
    expect(s.por_categoria).toEqual({ '10': [1] })
  })

  it('el mínimo por defecto es MIN_CATEGORIAS_TRANSVERSAL', () => {
    const tres = [...uso(1, 10), ...uso(1, 20), ...uso(1, 30)]
    expect(computeSugerencias(tres).transversales).toEqual(MIN_CATEGORIAS_TRANSVERSAL <= 3 ? [1] : [])
  })
})

describe('etiquetasSugeridas', () => {
  const sugerencias = { transversales: [90, 91], por_categoria: { '10': [1, 2], '20': [2, 90] }, reglas: [] }

  /** Mismo payload con reglas manuales encima. */
  const conReglas = (...reglas: ReglaEtiqueta[]) => ({ ...sugerencias, reglas })

  it('pone las propias de la categoría antes que las transversales', () => {
    expect(etiquetasSugeridas(sugerencias, 10)).toEqual([1, 2, 90, 91])
  })

  it('no repite la transversal que además es propia de la categoría', () => {
    expect(etiquetasSugeridas(sugerencias, 20)).toEqual([2, 90, 91])
  })

  it('una categoría sin histórico recibe sólo las transversales', () => {
    // Arranque en frío: la categoría nueva no queda con el dropdown vacío.
    expect(etiquetasSugeridas(sugerencias, 999)).toEqual([90, 91])
  })

  it('devuelve null sin categoría elegida — no hay criterio para recortar', () => {
    expect(etiquetasSugeridas(sugerencias, null)).toBeNull()
    expect(etiquetasSugeridas(sugerencias, undefined)).toBeNull()
  })

  it('devuelve null si las sugerencias no cargaron', () => {
    expect(etiquetasSugeridas(null, 10)).toBeNull()
    expect(etiquetasSugeridas(undefined, 10)).toBeNull()
  })

  it('devuelve null si no hay nada que sugerir y ninguna regla lo explica', () => {
    // Base recién estrenada: sin datos no hay recorte, hay falta de información.
    const vacio = { transversales: [], por_categoria: {}, reglas: [] }
    expect(etiquetasSugeridas(vacio, 10)).toBeNull()
  })

  it('tolera un payload sin las claves esperadas', () => {
    expect(etiquetasSugeridas({} as any, 10)).toBeNull()
  })

  it('la fijada va primero, aunque el histórico no la respalde', () => {
    const s = conReglas({ categoria_id: 10, etiqueta_id: 77, modo: 'fijar' })
    expect(etiquetasSugeridas(s, 10)).toEqual([77, 1, 2, 90, 91])
  })

  it('la excluida no aparece aunque sea propia de la categoría', () => {
    const s = conReglas({ categoria_id: 10, etiqueta_id: 1, modo: 'excluir' })
    expect(etiquetasSugeridas(s, 10)).toEqual([2, 90, 91])
  })

  it('la excluida no aparece aunque sea transversal', () => {
    // El caso que motiva el modo: `Mercado Pago` se ofrece en todas menos donde no va.
    const s = conReglas({ categoria_id: 10, etiqueta_id: 90, modo: 'excluir' })
    expect(etiquetasSugeridas(s, 10)).toEqual([1, 2, 91])
  })

  it('la regla de otra categoría no afecta a esta', () => {
    const s = conReglas({ categoria_id: 20, etiqueta_id: 1, modo: 'excluir' })
    expect(etiquetasSugeridas(s, 10)).toEqual([1, 2, 90, 91])
  })

  it('una categoría nueva puede quedar armada sólo con fijadas', () => {
    const s = { transversales: [], por_categoria: {}, reglas: [
      { categoria_id: 7, etiqueta_id: 4, modo: 'fijar' as const },
      { categoria_id: 7, etiqueta_id: 9, modo: 'fijar' as const },
    ] }
    expect(etiquetasSugeridas(s, 7)).toEqual([4, 9])
  })

  it('excluir todo deja el set vacío — es un recorte real, no un "mostrá todas"', () => {
    const s = conReglas(
      { categoria_id: 30, etiqueta_id: 90, modo: 'excluir' },
      { categoria_id: 30, etiqueta_id: 91, modo: 'excluir' },
    )
    expect(etiquetasSugeridas(s, 30)).toEqual([])
  })
})

describe('reglasDeCategoria', () => {
  const sugerencias = {
    transversales: [],
    por_categoria: {},
    reglas: [
      { categoria_id: 10, etiqueta_id: 1, modo: 'fijar' as const },
      { categoria_id: 10, etiqueta_id: 2, modo: 'excluir' as const },
      { categoria_id: 20, etiqueta_id: 3, modo: 'fijar' as const },
    ],
  }

  it('separa por modo y filtra por categoría', () => {
    expect(reglasDeCategoria(sugerencias, 10)).toEqual({ fijar: [1], excluir: [2] })
    expect(reglasDeCategoria(sugerencias, 20)).toEqual({ fijar: [3], excluir: [] })
  })

  it('una categoría sin reglas devuelve las dos listas vacías', () => {
    expect(reglasDeCategoria(sugerencias, 99)).toEqual({ fijar: [], excluir: [] })
    expect(reglasDeCategoria(null, 10)).toEqual({ fijar: [], excluir: [] })
  })
})

describe('origenEtiqueta', () => {
  const sugerencias = {
    transversales: [90],
    por_categoria: { '10': [1, 90] },
    reglas: [
      { categoria_id: 10, etiqueta_id: 77, modo: 'fijar' as const },
      { categoria_id: 10, etiqueta_id: 1, modo: 'excluir' as const },
    ],
  }

  it('distingue los cinco estados', () => {
    // La excluida es propia del histórico: la regla gana y el ABM tiene que mostrar por qué.
    expect(origenEtiqueta(sugerencias, 10, 1)).toBe('excluida')
    expect(origenEtiqueta(sugerencias, 10, 77)).toBe('fijada')
    expect(origenEtiqueta(sugerencias, 10, 90)).toBe('historico')
    expect(origenEtiqueta(sugerencias, 20, 90)).toBe('transversal')
    expect(origenEtiqueta(sugerencias, 20, 5)).toBe('ninguno')
  })

  it('sin sugerencias cargadas nada tiene origen', () => {
    expect(origenEtiqueta(null, 10, 1)).toBe('ninguno')
  })
})

describe('parseReglasBody', () => {
  it('acepta las dos listas y deduplica', () => {
    expect(parseReglasBody({ fijar: [1, 1, 2], excluir: [3] })).toEqual({ ok: true, fijar: [1, 2], excluir: [3] })
  })

  it('acepta un body vacío — borrar todas las reglas es válido', () => {
    expect(parseReglasBody({})).toEqual({ ok: true, fijar: [], excluir: [] })
    expect(parseReglasBody({ fijar: [], excluir: [] })).toEqual({ ok: true, fijar: [], excluir: [] })
  })

  it('coerciona ids numéricos que vienen como string', () => {
    expect(parseReglasBody({ fijar: ['4'] })).toEqual({ ok: true, fijar: [4], excluir: [] })
  })

  it('rechaza la etiqueta fijada y excluida a la vez', () => {
    const r = parseReglasBody({ fijar: [5], excluir: [5] })
    expect(r).toEqual({ ok: false, error: expect.stringContaining('fijada y excluida') })
  })

  it('rechaza ids no enteros, cero o negativos', () => {
    for (const raw of [[0], [-1], [1.5], ['x'], [null]]) {
      expect(parseReglasBody({ fijar: raw }).ok).toBe(false)
    }
  })

  it('rechaza una lista que no es array', () => {
    expect(parseReglasBody({ fijar: 3 }).ok).toBe(false)
    expect(parseReglasBody({ excluir: 'a' }).ok).toBe(false)
  })
})
