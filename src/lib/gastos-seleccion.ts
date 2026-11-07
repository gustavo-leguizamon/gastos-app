/**
 * Suma de los gastos seleccionados en `GastosTable` (modo "Seleccionar varios").
 *
 * El total de cada gasto es el **mismo que se ve en la columna "Total ARS"**: un
 * gasto sin confirmar y con sub-items muestra el subtotal de sus sub-items en vez
 * de `total_ars`, así que la suma de la selección usa ese mismo valor — si no, la
 * cuenta no coincidiría con lo que el usuario está sumando a ojo.
 */
import { sumItemsTotal, type SubItemMontoLike } from './subitems-total'

export interface GastoSeleccionLike {
  id: number
  total_ars: number
  total_pagado: number
  total_restante: number
  confirmado: boolean
  items?: SubItemMontoLike[] | null
}

export interface TotalesSeleccion {
  cantidad: number
  total: number
  pagado: number
  restante: number
}

/** Total ARS que muestra la grilla para un gasto. */
export function totalVisible(g: GastoSeleccionLike): number {
  const hasItems = (g.items?.length ?? 0) > 0
  return !g.confirmado && hasItems ? sumItemsTotal(g.items) : g.total_ars
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Totales de los gastos cuyo id está en `ids`. Los ids que no corresponden a
 * ningún gasto cargado se ignoran (no suman ni cuentan).
 */
export function totalesSeleccion(gastos: GastoSeleccionLike[], ids: ReadonlySet<number>): TotalesSeleccion {
  let cantidad = 0
  let total = 0
  let pagado = 0
  let restante = 0
  for (const g of gastos) {
    if (!ids.has(g.id)) continue
    cantidad++
    total += totalVisible(g)
    pagado += g.total_pagado
    restante += g.total_restante
  }
  return { cantidad, total: round2(total), pagado: round2(pagado), restante: round2(restante) }
}
