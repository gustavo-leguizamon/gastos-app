// Helpers de fecha puros, sin dependencias de Prisma/Next, para poder testear
// en aislamiento la aritmética de meses (que es fácil de romper con el wraparound).

/**
 * Timezone de referencia de la app. Los jobs programados (cron de Vercel) corren en UTC,
 * así que no pueden usar la fecha local del server para decidir "hoy".
 */
export const TZ_ARGENTINA = 'America/Argentina/Buenos_Aires'

/**
 * Fecha `YYYY-MM-DD` de un `Date` en un timezone dado (default: Argentina).
 *
 * Es el equivalente server-side de lo que los client components hacen con
 * `getFullYear()/getMonth()/getDate()`: nunca usar `toISOString()`, que da UTC y
 * corre el día para timezones detrás de UTC. `en-CA` formatea justo como `YYYY-MM-DD`.
 */
export function fechaEnTimeZone(date: Date, timeZone: string = TZ_ARGENTINA): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Avanza un par (mes, anio) por `n` meses, manejando el wraparound de fin de año.
 * `mes` es 1-12. `n` puede ser negativo.
 *
 * Ej: shiftMonth(12, 2026, 1) → { mes: 1, anio: 2027 }
 *     shiftMonth(1, 2026, -1) → { mes: 12, anio: 2025 }
 */
export function shiftMonth(mes: number, anio: number, n: number): { mes: number; anio: number } {
  const m0 = mes - 1 + n
  return { mes: ((m0 % 12) + 12) % 12 + 1, anio: anio + Math.floor(m0 / 12) }
}

/**
 * Días completos entre dos fechas `YYYY-MM-DD` (`hasta - desde`). Negativo si
 * `hasta` es anterior a `desde`, `0` si son el mismo día.
 *
 * Parsea los componentes a mano y construye la fecha en UTC a mediodía: `new Date(str)`
 * interpretaría el string como UTC y correría el día en timezones detrás de UTC, y armarlo
 * como fecha local haría que un cambio de horario de verano en el medio devuelva 0.5 días.
 * Devuelve `null` si alguna de las dos no tiene formato válido.
 */
export function diasEntre(desde: string, hasta: string): number | null {
  const a = parseYMD(desde)
  const b = parseYMD(hasta)
  if (a === null || b === null) return null
  return Math.round((b - a) / 86_400_000)
}

/** Timestamp UTC del mediodía de una fecha `YYYY-MM-DD`, o `null` si no es válida. */
function parseYMD(fecha: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha ?? '')
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return Date.UTC(y, mo - 1, d, 12)
}

/**
 * Dada la fecha de un pago (`YYYY-MM-DD`) y el día de cierre de la tarjeta (1-31),
 * devuelve el `(mes, anio)` del resumen de tarjeta al que corresponde el pago.
 *
 * Un pago pertenece al resumen cuyo cierre es el primero en ocurrir en/después de
 * la fecha del pago (el cierre de un mes M produce el resumen de ese mismo mes M):
 * - día del pago <= día de cierre → el cierre de su propio mes todavía no ocurrió
 *   (o es justo ese día) → resumen = mes del pago.
 * - día del pago  > día de cierre → el cierre del mes ya pasó → resumen = mes siguiente.
 *
 * Es independiente del mes/año en que esté clasificado el gasto fuente: solo mira la
 * fecha del pago contra el día de cierre de la tarjeta.
 */
export function resolvePeriodoTarjeta(fecha: string, diaCierre: number): { mes: number; anio: number } {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  if (dia <= diaCierre) return { mes, anio }
  return shiftMonth(mes, anio, 1)
}

export interface CierreResumen {
  mes: number
  anio: number
  fechaCierre: string | null
}

/**
 * Resuelve el resumen de tarjeta al que pertenece un pago usando las fechas de cierre
 * COMPLETAS de la tarjeta (no solo el día del mes).
 *
 * Un pago pertenece al resumen cuyo `fechaCierre` es el PRIMERO que ocurre en/después de
 * la fecha del pago (el cierre incluye ese día). Esto es correcto aunque el cierre de un
 * resumen caiga en un mes distinto al que lo etiqueta — ej. el resumen de "junio" puede
 * cerrar el 28/05 y el próximo cierre ser el 02/07: un pago del 26/06 (posterior al cierre
 * del 28/05) pertenece entonces al resumen que cierra el 02/07 (julio), no a junio. El
 * heurístico por día suelto (`resolvePeriodoTarjeta`) fallaba en ese caso porque asumía que
 * cada resumen cierra dentro de su propio mes.
 *
 * @returns el `(mes, anio)` del resumen destino, o `null` si la tarjeta no tiene ningún
 *   `fechaCierre` configurado.
 */
export function resolvePeriodoTarjetaByCierres(
  fecha: string,
  cierres: CierreResumen[],
): { mes: number; anio: number } | null {
  const valid = cierres
    .filter((c): c is CierreResumen & { fechaCierre: string } => !!c.fechaCierre)
    .sort((a, b) => a.fechaCierre.localeCompare(b.fechaCierre))
  if (valid.length === 0) return null

  // Primer cierre en/después de la fecha del pago. La comparación lexicográfica es válida
  // sobre el formato 'YYYY-MM-DD'.
  const hit = valid.find(c => c.fechaCierre >= fecha)
  if (hit) return { mes: hit.mes, anio: hit.anio }

  // Pago posterior a TODOS los cierres conocidos: no hay una fecha real que lo contenga
  // (falta configurar cierres futuros). Best-effort: proyectar con el día del último cierre
  // conocido (el día de cierre es ~constante) vía el heurístico clásico relativo al mes del
  // pago. Menos preciso, pero solo aplica cuando faltan datos de cierre hacia adelante.
  const dia = Number(valid[valid.length - 1].fechaCierre.split('-')[2])
  return resolvePeriodoTarjeta(fecha, dia)
}
