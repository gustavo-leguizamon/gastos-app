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
