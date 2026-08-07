/**
 * Subtotal de sub-items vs. total cargado del gasto.
 *
 * La comparación se usaba inline en varios lugares de `GastosTable` (fila
 * "TOTAL SUB-ITEMS" del grid, card mobile, indicador en la fila del gasto).
 * Vive acá para que todos los renders usen exactamente el mismo criterio de
 * "coincide" y la misma suma (sólo items con `incluye_en_total`).
 */

/** Tolerancia de comparación: diferencias menores a medio centavo son "coincide". */
export const TOTAL_EPSILON = 0.005

export interface SubItemMontoLike {
  monto: number
  incluye_en_total: boolean
}

export interface SubitemsTotalCheck {
  /** El gasto tiene al menos un sub-item cargado. */
  hasItems: boolean
  /** Suma de los sub-items con `incluye_en_total`. */
  itemsTotal: number
  /** Total ARS cargado en el gasto. */
  gastoTotal: number
  /** `itemsTotal - gastoTotal` (positivo = los sub-items suman de más). */
  diferencia: number
  /** `true` si coinciden dentro de `TOTAL_EPSILON` (o si no hay sub-items). */
  matches: boolean
}

/** Suma los sub-items que participan del total. */
export function sumItemsTotal(items: SubItemMontoLike[] | null | undefined): number {
  return (items ?? []).reduce((s, i) => (i.incluye_en_total ? s + i.monto : s), 0)
}

/** Compara el subtotal de sub-items contra el total cargado del gasto. */
export function checkSubitemsTotal(
  items: SubItemMontoLike[] | null | undefined,
  gastoTotal: number
): SubitemsTotalCheck {
  const hasItems = (items?.length ?? 0) > 0
  const itemsTotal = sumItemsTotal(items)
  const diferencia = itemsTotal - gastoTotal
  return {
    hasItems,
    itemsTotal,
    gastoTotal,
    diferencia,
    matches: !hasItems || Math.abs(diferencia) < TOTAL_EPSILON,
  }
}

/** `true` cuando hay sub-items y su subtotal difiere del total cargado. */
export function difiereSubtotal(
  items: SubItemMontoLike[] | null | undefined,
  gastoTotal: number
): boolean {
  const { hasItems, matches } = checkSubitemsTotal(items, gastoTotal)
  return hasItems && !matches
}
