// Helpers de fecha puros, sin dependencias de Prisma/Next, para poder testear
// en aislamiento la aritmética de meses (que es fácil de romper con el wraparound).

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
