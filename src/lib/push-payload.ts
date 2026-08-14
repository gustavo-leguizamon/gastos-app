// Texto de la notificación push de vencimientos del día. Puro (sin web-push ni Prisma)
// para poder testear el copy y el formateo de montos sin salir a la red.

import type { VencimientoHoy } from './vencimientos'

/** Lo que viaja en el `data` del push y lee el service worker (`sw.js`). */
export interface PushPayload {
  title: string
  body: string
  /** A dónde navega el click en la notificación. */
  url: string
  /** Colapsa notificaciones: una nueva con el mismo tag reemplaza a la anterior. */
  tag: string
}

/** Tag fijo de la notificación diaria — así no se apilan varias del mismo día. */
export const TAG_VENCIMIENTOS = 'vencimientos-hoy'

/** Cuántas descripciones se listan en el body antes de resumir con "y N más". */
const MAX_NOMBRES = 3

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

/**
 * Arma el push de los vencimientos del día. Devuelve `null` si no hay nada que avisar
 * (el cron no manda notificación vacía).
 *
 * - 1 entrada  → `"Vence hoy: Luz"` / `"$12.345,67 · Casa"`
 * - N entradas → `"3 vencimientos hoy"` / `"Total $X · Luz, Internet y 1 más"`
 */
export function buildVencimientosPush(entradas: VencimientoHoy[] | null | undefined): PushPayload | null {
  const list = entradas ?? []
  if (list.length === 0) return null

  const total = list.reduce((s, e) => s + e.monto, 0)

  if (list.length === 1) {
    const [e] = list
    const sufijo = e.casa_nombre ? ` · ${e.casa_nombre}` : ''
    return {
      title: `Vence hoy: ${e.descripcion}`,
      body: `${fmtARS(e.monto)}${sufijo}`,
      url: '/gastos',
      tag: TAG_VENCIMIENTOS,
    }
  }

  const nombres = list.slice(0, MAX_NOMBRES).map(e => e.descripcion)
  const resto = list.length - nombres.length
  const detalle = resto > 0 ? `${nombres.join(', ')} y ${resto} más` : nombres.join(', ')

  return {
    title: `${list.length} vencimientos hoy`,
    body: `Total ${fmtARS(total)} · ${detalle}`,
    url: '/gastos',
    tag: TAG_VENCIMIENTOS,
  }
}
