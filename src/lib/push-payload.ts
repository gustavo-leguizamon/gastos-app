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

/** `Luz, Internet y 2 más` — hasta `MAX_NOMBRES` descripciones y el resto resumido. */
function listarNombres(entradas: VencimientoHoy[]): string {
  const nombres = entradas.slice(0, MAX_NOMBRES).map(e => e.descripcion)
  const resto = entradas.length - nombres.length
  return resto > 0 ? `${nombres.join(', ')} y ${resto} más` : nombres.join(', ')
}

/** `hace 1 día` / `hace 5 días`. */
function atraso(dias: number): string {
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`
}

/**
 * Arma el push de vencimientos. Devuelve `null` si no hay nada que avisar (el cron no
 * manda notificación vacía).
 *
 * Los **vencidos** mandan sobre los de hoy en el título: si algo ya se pasó de fecha, es
 * lo primero que hay que ver. Sin esto un atraso quedaba invisible — el aviso del día era
 * la única señal y no se repetía nunca.
 *
 * - Sólo hoy, 1        → `"Vence hoy: Luz"` / `"$12.345,67 · Casa"`
 * - Sólo hoy, N        → `"3 vencimientos hoy"` / `"Total $X · Luz, Internet y 1 más"`
 * - Sólo vencidos, 1   → `"Vencido hace 3 días: Luz"` / `"$12.345,67 · Casa"`
 * - Sólo vencidos, N   → `"3 vencimientos atrasados"` / `"Total $X · Luz, Internet y 1 más"`
 * - Mezcla             → `"2 vencidos y 1 vence hoy"` / `"Total $X · Luz, Internet y 1 más"`
 *
 * Una entrada sin `estado` se toma como de hoy (forma vieja de `VencimientoHoy`).
 */
export function buildVencimientosPush(entradas: VencimientoHoy[] | null | undefined): PushPayload | null {
  const list = entradas ?? []
  if (list.length === 0) return null

  const total = list.reduce((s, e) => s + e.monto, 0)
  const vencidos = list.filter(e => e.estado === 'vencido')
  const hoy = list.filter(e => e.estado !== 'vencido')

  // Los vencidos primero, del más atrasado al menos: es el orden en el que conviene leerlos.
  const ordenadas = [...vencidos, ...hoy]

  if (list.length === 1) {
    const [e] = ordenadas
    const sufijo = e.casa_nombre ? ` · ${e.casa_nombre}` : ''
    const title = e.estado === 'vencido'
      ? `Vencido ${atraso(e.dias_atraso)}: ${e.descripcion}`
      : `Vence hoy: ${e.descripcion}`
    return { title, body: `${fmtARS(e.monto)}${sufijo}`, url: '/gastos', tag: TAG_VENCIMIENTOS }
  }

  let title: string
  if (vencidos.length === 0) title = `${hoy.length} vencimientos hoy`
  else if (hoy.length === 0) title = `${vencidos.length} vencimientos atrasados`
  else {
    const v = vencidos.length === 1 ? '1 vencido' : `${vencidos.length} vencidos`
    const h = hoy.length === 1 ? '1 vence hoy' : `${hoy.length} vencen hoy`
    title = `${v} y ${h}`
  }

  return {
    title,
    body: `Total ${fmtARS(total)} · ${listarNombres(ordenadas)}`,
    url: '/gastos',
    tag: TAG_VENCIMIENTOS,
  }
}
