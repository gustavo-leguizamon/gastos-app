// Reglas compartidas por la card "Pagar hoy" (`/api/resumen` → `computeResumen`),
// el alert de vencimientos del día (`VencimientosHoyAlert`) y la notificación push
// diaria (`/api/cron/vencimientos`). Viven acá para que no se desincronicen y para
// poder testearlas sin Prisma/React.

import { sumItemsTotal } from './subitems-total'
import { diasEntre } from './fechas'

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

/** Si la entrada vence justo hoy o si ya se pasó de fecha y sigue impaga. */
export type EstadoVencimiento = 'hoy' | 'vencido'

/** Una entrada que vence hoy o que ya venció: el gasto en sí o uno de sus sub-items. */
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
  estado: EstadoVencimiento
  /** Fecha de vencimiento de la entrada (`YYYY-MM-DD`). */
  fecha: string
  /** Días de atraso respecto de `today`. `0` cuando vence hoy. */
  dias_atraso: number
}

/**
 * Vencimientos del día `today` (`YYYY-MM-DD`) **y** los que ya se pasaron de fecha y
 * siguen impagos, sobre una lista de gastos ya mapeada a la forma de la API.
 *
 * Sigue la misma regla de reparto que `pagar_hoy` en `computeResumen`:
 * - Si el gasto {@link vencePorGasto} (sin sub-items o resumen de tarjeta), vence por su
 *   propia `fecha_vencimiento` y aporta su **restante** — si no está confirmado el total
 *   sale de la suma de sub-items en vez de `total_ars`.
 * - Si no, sólo cuentan los sub-items marcados `incluye_en_vencimiento`.
 *
 * Los gastos sin confirmar y sin sub-items se ignoran (no hay monto en el que confiar).
 *
 * **Asimetría deliberada en los sub-items vencidos:** un sub-item no tiene estado de pago
 * propio (son display-only), así que el único indicio disponible es el restante del gasto
 * padre. Para `estado: 'vencido'` se exige que el padre siga con saldo; si no, un resumen de
 * tarjeta ya pagado reportaría como vencido cada consumo pasado, para siempre. Los sub-items
 * de **hoy** conservan el comportamiento histórico (entran sin mirar el restante del padre)
 * para no alterar `pagar_hoy` ni el alert del día.
 *
 * El orden es: primero los vencidos (el más atrasado arriba) y después los de hoy.
 */
export function vencimientosPendientes(
  gastos: GastoVencimientoLike[] | null | undefined,
  today: string,
): VencimientoHoy[] {
  const out: VencimientoHoy[] = []

  const push = (e: Omit<VencimientoHoy, 'estado' | 'dias_atraso'>) => {
    const atraso = diasEntre(e.fecha, today) ?? 0
    out.push({ ...e, estado: atraso > 0 ? 'vencido' : 'hoy', dias_atraso: Math.max(0, atraso) })
  }

  for (const g of gastos ?? []) {
    const items = g.items ?? []
    if (!g.confirmado && items.length === 0) continue

    if (vencePorGasto(g.es_tarjeta, items.length)) {
      const totalArs = g.confirmado ? g.total_ars : sumItemsTotal(items)
      const restante = Math.round((totalArs - g.total_pagado) * 100) / 100
      if (g.fecha_vencimiento <= today && restante > 0) {
        push({
          key: `g-${g.id}`,
          tipo: 'gasto',
          descripcion: g.descripcion,
          casa_nombre: g.casa_nombre,
          monto: restante,
          fecha: g.fecha_vencimiento,
        })
      }
    } else {
      const totalArs = g.confirmado ? g.total_ars : sumItemsTotal(items)
      const restanteParent = Math.round((totalArs - g.total_pagado) * 100) / 100
      for (const it of items) {
        if (!it.incluye_en_vencimiento || !it.fecha || it.fecha > today) continue
        // Ver la asimetría documentada arriba: los pasados exigen que el padre siga con saldo.
        if (it.fecha < today && restanteParent <= 0) continue
        push({
          key: `i-${it.id}`,
          tipo: 'subitem',
          descripcion: it.descripcion,
          parent: g.descripcion,
          casa_nombre: g.casa_nombre,
          monto: it.monto,
          fecha: it.fecha,
        })
      }
    }
  }

  return out.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
}

/**
 * Sólo los vencimientos de hoy — el comportamiento histórico, antes de que existieran
 * los vencidos. Lo usan `pagar_hoy` y todo lo que no deba mezclar atrasados.
 */
export function vencimientosDelDia(
  gastos: GastoVencimientoLike[] | null | undefined,
  today: string,
): VencimientoHoy[] {
  return vencimientosPendientes(gastos, today).filter(v => v.estado === 'hoy')
}

/** Total de una lista de vencimientos (helper para no repetir el reduce + redondeo). */
export function sumVencimientos(entradas: VencimientoHoy[]): number {
  return Math.round(entradas.reduce((s, v) => s + v.monto, 0) * 100) / 100
}
