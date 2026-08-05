// Regla compartida por la card "Pagar hoy" (`/api/resumen` → `computeResumen`) y
// el alert de vencimientos del día (`VencimientosHoyAlert`). Vive acá para que
// ambos no se desincronicen y para poder testearla sin Prisma/React.

/**
 * `true` si el gasto vence **por sí mismo** (su `fechaVencimiento` + su restante),
 * `false` si el vencimiento se calcula a partir de los sub-items marcados
 * "incluir en vencimiento".
 *
 * Vence por sí mismo cuando:
 * - no tiene sub-items, o
 * - es un **resumen de tarjeta** (`esTarjeta`): sus sub-items son los consumos
 *   propagados del período (siempre con `incluyeEnVencimiento = false`), no
 *   vencimientos independientes — el total del resumen vence en la fecha de
 *   vencimiento de la tarjeta.
 */
export function vencePorGasto(
  esTarjeta: boolean | null | undefined,
  itemsCount: number,
): boolean {
  return Boolean(esTarjeta) || itemsCount === 0
}
