// Predicado de la búsqueda libre de la grilla de gastos. Vive acá (puro, sin React/MUI)
// porque decide qué filas ve el usuario: si se rompe en silencio, un gasto cargado
// "desaparece" y no hay forma de notarlo mirando la pantalla.

/** Forma mínima de un gasto para buscar sobre él (subconjunto de `Gasto`). */
export interface GastoBuscable {
  descripcion: string
  notas?: string | null
  categoria?: { nombre: string } | null
  etiquetas?: { nombre: string }[] | null
  items?: {
    descripcion: string
    categoria?: { nombre: string } | null
    etiquetas?: { nombre: string }[] | null
  }[] | null
}

/**
 * Campos sobre los que matchea la búsqueda, en orden de obviedad para el usuario:
 * descripción del gasto, su categoría y etiquetas, sus **notas**, y la descripción,
 * categoría y etiquetas de **cada sub-ítem**.
 *
 * Los sub-ítems entran porque en un resumen de tarjeta el detalle vive ahí: buscar
 * "Netflix" tiene que encontrar el resumen que lo contiene, no sólo un gasto que se
 * llame así. Cuando el match viene de un sub-ítem se devuelve igual la **fila del gasto
 * padre** (la grilla filtra a nivel gasto), con sus sub-ítems intactos al expandir.
 */
export function matchBusqueda(gasto: GastoBuscable, busqueda: string): boolean {
  const q = busqueda.trim().toLowerCase()
  if (!q) return true

  const contiene = (s: string | null | undefined) => (s ?? '').toLowerCase().includes(q)
  const enEtiquetas = (etiquetas: { nombre: string }[] | null | undefined) =>
    (etiquetas ?? []).some(e => contiene(e.nombre))

  if (contiene(gasto.descripcion)) return true
  if (contiene(gasto.notas)) return true
  if (contiene(gasto.categoria?.nombre)) return true
  if (enEtiquetas(gasto.etiquetas)) return true

  return (gasto.items ?? []).some(
    it => contiene(it.descripcion) || contiene(it.categoria?.nombre) || enEtiquetas(it.etiquetas),
  )
}

// ─── Filtros del detalle de sub-ítems (dialog "Sub-items") ──────────────────

/** Estados del filtro por marca de verificación de un sub-ítem. */
export type FiltroVerificado = 'todos' | 'verificados' | 'pendientes'

/** Forma mínima de un sub-ítem para filtrarlo (subconjunto de `GastoItem`). */
export interface SubitemFiltrable {
  descripcion: string
  verificado?: boolean | null
  categoria?: { nombre: string } | null
  etiquetas?: { nombre: string }[] | null
}

/**
 * Predicado del detalle de sub-ítems: búsqueda libre (descripción, categoría y
 * etiquetas del sub-ítem) **y** estado de la marca de verificado.
 *
 * Vive acá por lo mismo que `matchBusqueda`: decide qué filas ve el usuario al
 * revisar un resumen de tarjeta, y un sub-ítem que "desaparece" no se nota mirando
 * la pantalla. `verificado` ausente/`null` cuenta como no verificado (pendiente).
 */
export function matchSubitem(
  item: SubitemFiltrable,
  busqueda: string,
  verificado: FiltroVerificado = 'todos',
): boolean {
  if (verificado === 'verificados' && !item.verificado) return false
  if (verificado === 'pendientes' && item.verificado) return false

  const q = busqueda.trim().toLowerCase()
  if (!q) return true

  const contiene = (s: string | null | undefined) => (s ?? '').toLowerCase().includes(q)
  return contiene(item.descripcion)
    || contiene(item.categoria?.nombre)
    || (item.etiquetas ?? []).some(e => contiene(e.nombre))
}
