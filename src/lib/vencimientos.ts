// Reglas compartidas por la card "Pagar hoy" (`/api/resumen` → `computeResumen`),
// el alert de vencimientos del día (`VencimientosHoyAlert`) y la notificación push
// diaria (`/api/cron/vencimientos`). Viven acá para que no se desincronicen y para
// poder testearlas sin Prisma/React.

import { sumItemsTotal } from './subitems-total'

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

/** Sub-item mínimo que necesita `vencimientosDelDia`. */
export interface ItemVencimientoLike {
  id: number
  descripcion: string
  monto: number
  fecha: string | null
  incluye_en_total: boolean
  incluye_en_vencimiento: boolean
}

/** Gasto mínimo que necesita `vencimientosDelDia` (forma snake_case de la API). */
export interface GastoVencimientoLike {
  id: number
  descripcion: string
  casa_nombre?: string
  fecha_vencimiento: string
  total_ars: number
  total_pagado: number
  confirmado: boolean
  es_tarjeta: boolean
  items?: ItemVencimientoLike[] | null
}

/** Una entrada que vence hoy: el gasto en sí o uno de sus sub-items. */
export interface VencimientoHoy {
  /** Key estable para React y para deduplicar (`g-<id>` / `i-<id>`). */
  key: string
  tipo: 'gasto' | 'subitem'
  descripcion: string
  /** Descripción del gasto padre (sólo en `tipo: 'subitem'`). */
  parent?: string
  casa_nombre?: string
  /** Monto que falta pagar: restante del gasto, o monto del sub-item. */
  monto: number
}

/**
 * Vencimientos pendientes del día `today` (`YYYY-MM-DD`) sobre una lista de gastos
 * ya mapeada a la forma de la API.
 *
 * Sigue la misma regla que `pagar_hoy` en `computeResumen`:
 * - Si el gasto {@link vencePorGasto} (sin sub-items o resumen de tarjeta), vence por su
 *   propia `fecha_vencimiento` y aporta su **restante** — si no está confirmado el total
 *   sale de la suma de sub-items en vez de `total_ars`.
 * - Si no, sólo cuentan los sub-items marcados `incluye_en_vencimiento` con `fecha === today`.
 *
 * Los gastos sin confirmar y sin sub-items se ignoran (no hay monto en el que confiar).
 */
export function vencimientosDelDia(
  gastos: GastoVencimientoLike[] | null | undefined,
  today: string,
): VencimientoHoy[] {
  const out: VencimientoHoy[] = []

  for (const g of gastos ?? []) {
    const items = g.items ?? []
    if (!g.confirmado && items.length === 0) continue

    if (vencePorGasto(g.es_tarjeta, items.length)) {
      const totalArs = g.confirmado ? g.total_ars : sumItemsTotal(items)
      const restante = Math.round((totalArs - g.total_pagado) * 100) / 100
      if (g.fecha_vencimiento === today && restante > 0) {
        out.push({
          key: `g-${g.id}`,
          tipo: 'gasto',
          descripcion: g.descripcion,
          casa_nombre: g.casa_nombre,
          monto: restante,
        })
      }
    } else {
      for (const it of items) {
        if (it.incluye_en_vencimiento && it.fecha === today) {
          out.push({
            key: `i-${it.id}`,
            tipo: 'subitem',
            descripcion: it.descripcion,
            parent: g.descripcion,
            casa_nombre: g.casa_nombre,
            monto: it.monto,
          })
        }
      }
    }
  }

  return out
}
