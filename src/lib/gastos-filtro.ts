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
