// Qué etiquetas ofrecerle al usuario según la categoría del gasto, derivado del histórico.
//
// Por qué existe: el multiselect de etiquetas ofrecía las 35 etiquetas del sistema para
// cualquier gasto, cuando el set relevante por categoría es de 1 a 11 (`Delivery` no comparte
// nada con `Celular`). La alternativa —una whitelist por categoría mantenida a mano— rompe el
// caso de las etiquetas transversales, que son las más usadas: `Mercado Libre` aparece en 10
// categorías, `Mercado Pago` en 8, `PedidosYa` en 4 con 318 usos. Habría que declararlas en
// casi todas, y la que se olvide termina retipeada como variante del mismo nombre — el eje
// partido en dos que `resolveEtiqueta` existe para evitar.
//
// Así que no se configura: se calcula. Una etiqueta se sugiere para una categoría si ya se usó
// con ella, y las que cruzan `MIN_CATEGORIAS_TRANSVERSAL` categorías se sugieren siempre. Cero
// mantenimiento y se aprende sola: la etiqueta nueva que se crea inline queda asociada a la
// categoría por el solo hecho de haberse usado ahí.
//
// El recorte es **blando**: la UI muestra el set corto pero deja expandir a todas, y al tipear
// busca sobre todas (ver `AppMultiSelect`). Esto nunca esconde una etiqueta de forma
// definitiva — sólo cambia el orden en que aparecen.
//
// Encima de lo derivado hay una capa de **excepciones manuales** (`CategoriaEtiquetaRegla`, ABM
// en `/configuracion`) para los dos casos que el histórico no puede resolver solo: la categoría
// nueva que todavía no tiene datos (`fijar`) y el uso puntual mal clasificado que quedó
// contaminando la lista para siempre (`excluir`). Es una capa de excepciones y no la fuente de
// verdad: lo normal es no tener ninguna regla.

/** Una etiqueta aplicada a un gasto o sub-item, con la categoría de esa fila (puede no tener). */
export interface UsoEtiqueta {
  etiquetaId: number
  categoriaId: number | null
}

/** Los dos modos de la corrección manual. Ver el modelo `CategoriaEtiquetaRegla`. */
export type ModoRegla = 'fijar' | 'excluir'

export const MODOS_REGLA: ModoRegla[] = ['fijar', 'excluir']

/** Una excepción manual, en snake_case como todo lo que sale de la API. */
export interface ReglaEtiqueta {
  categoria_id: number
  etiqueta_id: number
  modo: ModoRegla
}

/**
 * Payload de `GET /api/etiquetas/sugeridas`. Se pide una vez y sirve para todas las
 * categorías: cambiar la categoría en el form no dispara otro fetch.
 */
export interface SugerenciasEtiquetas {
  /** Ids de las etiquetas transversales — se sugieren para cualquier categoría. */
  transversales: number[]
  /** categoriaId (clave de objeto JSON, o sea string) → ids de etiquetas usadas con ella. */
  por_categoria: Record<string, number[]>
  /**
   * Excepciones manuales sobre lo derivado (tabla `CategoriaEtiquetaRegla`). Normalmente viene
   * vacío: la lista base sale del histórico y esto sólo corrige lo que el histórico no acierta.
   */
  reglas: ReglaEtiqueta[]
}

/**
 * Desde cuántas categorías distintas una etiqueta deja de ser propia de una categoría y pasa
 * a ser un corte transversal. En 3 quedan afuera las específicas (`Panaderia`, `Dentista`) y
 * adentro las de canal/marcador (`Mercado Libre`, `Rappi`, `Impuesto`, `Devolucion`).
 */
export const MIN_CATEGORIAS_TRANSVERSAL = 3

/**
 * Agrega las filas de uso en el payload de sugerencias.
 *
 * Los usos sin categoría cuentan para el total de la etiqueta pero no la asocian a ninguna
 * categoría ni suman a su transversalidad — no dicen nada sobre dónde ofrecerla.
 *
 * Orden dentro de cada lista: más usada primero, y a igual uso por id, para que el payload sea
 * determinístico y el usuario no vea el dropdown reordenarse entre cargas.
 */
export function computeSugerencias(
  usos: UsoEtiqueta[],
  minCategorias: number = MIN_CATEGORIAS_TRANSVERSAL,
  reglas: ReglaEtiqueta[] = [],
): SugerenciasEtiquetas {
  /** etiquetaId → usos totales (incluye los usos sin categoría). */
  const usosPorEtiqueta = new Map<number, number>()
  /** etiquetaId → categorías distintas donde se usó. */
  const categoriasPorEtiqueta = new Map<number, Set<number>>()
  /** `${categoriaId}` → (etiquetaId → usos en esa categoría). */
  const porCategoria = new Map<number, Map<number, number>>()

  for (const uso of usos) {
    const { etiquetaId, categoriaId } = uso
    if (!Number.isInteger(etiquetaId)) continue
    usosPorEtiqueta.set(etiquetaId, (usosPorEtiqueta.get(etiquetaId) ?? 0) + 1)
    if (categoriaId == null) continue

    if (!categoriasPorEtiqueta.has(etiquetaId)) categoriasPorEtiqueta.set(etiquetaId, new Set())
    categoriasPorEtiqueta.get(etiquetaId)!.add(categoriaId)

    if (!porCategoria.has(categoriaId)) porCategoria.set(categoriaId, new Map())
    const cuentas = porCategoria.get(categoriaId)!
    cuentas.set(etiquetaId, (cuentas.get(etiquetaId) ?? 0) + 1)
  }

  const transversales = [...categoriasPorEtiqueta.entries()]
    .filter(([, cats]) => cats.size >= minCategorias)
    .map(([etiquetaId, cats]) => ({ etiquetaId, cats: cats.size, usos: usosPorEtiqueta.get(etiquetaId) ?? 0 }))
    .sort((a, b) => b.cats - a.cats || b.usos - a.usos || a.etiquetaId - b.etiquetaId)
    .map(e => e.etiquetaId)

  const por_categoria: Record<string, number[]> = {}
  for (const [categoriaId, cuentas] of porCategoria) {
    por_categoria[String(categoriaId)] = [...cuentas.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .map(([etiquetaId]) => etiquetaId)
  }

  return { transversales, por_categoria, reglas }
}

/** Las reglas de una categoría, separadas por modo. Prefilea el diálogo del ABM. */
export function reglasDeCategoria(
  sugerencias: SugerenciasEtiquetas | null | undefined,
  categoriaId: number | null | undefined,
): { fijar: number[]; excluir: number[] } {
  const reglas = (sugerencias?.reglas ?? []).filter(r => r.categoria_id === categoriaId)
  return {
    fijar: reglas.filter(r => r.modo === 'fijar').map(r => r.etiqueta_id),
    excluir: reglas.filter(r => r.modo === 'excluir').map(r => r.etiqueta_id),
  }
}

/**
 * Qué etiquetas destacar para una categoría: primero las fijadas a mano, después las propias de
 * la categoría (más usadas arriba) y por último las transversales. Las excluidas no aparecen,
 * vengan de donde vengan — excluir gana sobre fijar y sobre el histórico.
 *
 * Las fijadas van primero porque son una decisión explícita del usuario sobre esta categoría,
 * más fuerte que cualquier frecuencia.
 *
 * Devuelve `null` cuando no hay criterio para recortar — y en ese caso la UI muestra todas:
 * sin sugerencias cargadas, sin categoría elegida, o cuando no hay **nada** que sugerir y
 * ninguna regla que lo explique (base recién estrenada, sin un solo gasto etiquetado: recortar a
 * cero dejaría el dropdown vacío por falta de datos, que no es lo mismo que un recorte).
 *
 * `[]` sí es un recorte legítimo y se devuelve tal cual: es lo que queda cuando se excluyeron a
 * mano todas las candidatas, y ahí el vacío es la decisión del usuario, no la ausencia de datos.
 */
export function etiquetasSugeridas(
  sugerencias: SugerenciasEtiquetas | null | undefined,
  categoriaId: number | null | undefined,
): number[] | null {
  if (!sugerencias || categoriaId == null) return null
  const { fijar, excluir } = reglasDeCategoria(sugerencias, categoriaId)
  const excluidas = new Set(excluir)
  const propias = sugerencias.por_categoria?.[String(categoriaId)] ?? []
  const orden = [...fijar, ...propias, ...(sugerencias.transversales ?? [])]

  const vistas = new Set<number>()
  const sugeridas = orden.filter(id => {
    if (excluidas.has(id) || vistas.has(id)) return false
    vistas.add(id)
    return true
  })

  if (sugeridas.length === 0 && excluir.length === 0) return null
  return sugeridas
}

/**
 * De dónde sale (o por qué no sale) una etiqueta en una categoría. Es lo que el ABM muestra
 * como estado de cada fila, y el motivo por el que la vista no es una simple tabla de relaciones:
 * la mayoría de los pares no están guardados en ninguna parte.
 */
export type OrigenSugerencia = 'excluida' | 'fijada' | 'historico' | 'transversal' | 'ninguno'

export function origenEtiqueta(
  sugerencias: SugerenciasEtiquetas | null | undefined,
  categoriaId: number,
  etiquetaId: number,
): OrigenSugerencia {
  const { fijar, excluir } = reglasDeCategoria(sugerencias, categoriaId)
  if (excluir.includes(etiquetaId)) return 'excluida'
  if (fijar.includes(etiquetaId)) return 'fijada'
  if ((sugerencias?.por_categoria?.[String(categoriaId)] ?? []).includes(etiquetaId)) return 'historico'
  if ((sugerencias?.transversales ?? []).includes(etiquetaId)) return 'transversal'
  return 'ninguno'
}

/**
 * Valida el body de `PUT /api/categorias/[id]/etiquetas` (`{ fijar, excluir }`). Dedup y coerción
 * a number, y rechaza la etiqueta que viene en las dos listas: sería una regla contradictoria
 * guardada como dos filas, y sólo una podría existir por el unique `(categoriaId, etiquetaId)`.
 */
export function parseReglasBody(
  body: any,
): { ok: true; fijar: number[]; excluir: number[] } | { ok: false; error: string } {
  const parseLista = (raw: any, campo: string) => {
    if (raw == null) return { ok: true as const, ids: [] as number[] }
    if (!Array.isArray(raw)) return { ok: false as const, error: `${campo} debe ser un array de ids` }
    const ids: number[] = []
    for (const item of raw) {
      const id = Number(item)
      if (!Number.isInteger(id) || id <= 0) return { ok: false as const, error: `${campo} tiene un id inválido` }
      if (!ids.includes(id)) ids.push(id)
    }
    return { ok: true as const, ids }
  }

  const fijar = parseLista(body?.fijar, 'fijar')
  if (!fijar.ok) return { ok: false, error: fijar.error }
  const excluir = parseLista(body?.excluir, 'excluir')
  if (!excluir.ok) return { ok: false, error: excluir.error }

  const repetida = fijar.ids.find(id => excluir.ids.includes(id))
  if (repetida != null) {
    return { ok: false, error: 'Una etiqueta no puede estar fijada y excluida a la vez' }
  }
  return { ok: true, fijar: fijar.ids, excluir: excluir.ids }
}
