// Cálculos de la sección Inversiones. Estaban inline en la página, que sólo derivaba
// `monto_actualizado` y `cambio` (absoluto): no había rendimiento porcentual ni nada que
// separara "subió porque puse plata" de "subió porque rindió" — que es toda la pregunta.

import type { Movimiento } from './types'

export interface MovimientoCalculado extends Movimiento {
  /** `monto_actual + movimiento`: el saldo después de aplicar el depósito/retiro. */
  monto_actualizado: number
  /** Diferencia de saldo contra la fila previa. `null` en la primera. */
  cambio: number | null
  /**
   * Ganancia del período: cuánto se movió el saldo **descontando** lo que se puso o sacó.
   * `null` en la primera fila (no hay período previo con el que comparar).
   *
   * Es la distinción que faltaba: si el saldo sube 1000 porque depositaste 1000, la
   * inversión no rindió nada. `cambio` mostraba +1000 igual.
   */
  ganancia: number | null
  /** `ganancia` como % del saldo previo. `null` si no hay previo o si el previo era 0. */
  rendimiento_pct: number | null
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Deriva los campos calculados de una lista de movimientos. **Espera el orden cronológico
 * ascendente** (fecha asc, id asc como desempate): cada fila se compara con la anterior.
 *
 * `ganancia = saldo_actual − saldo_previo − movimiento`. El `movimiento` de la fila es la
 * plata que entró o salió en ese período, así que restarla deja sólo lo que generó la
 * inversión por sí misma.
 */
export function computeMovimientos(movimientos: Movimiento[]): MovimientoCalculado[] {
  let previo: number | null = null

  return (movimientos ?? []).map((m) => {
    const actualizado = r2(m.monto_actual + m.movimiento)
    const cambio = previo === null ? null : r2(actualizado - previo)
    const ganancia = previo === null ? null : r2(actualizado - previo - m.movimiento)
    const rendimiento_pct =
      previo === null || previo === 0 || ganancia === null ? null : r2((ganancia / Math.abs(previo)) * 100)

    previo = actualizado
    return { ...m, monto_actualizado: actualizado, cambio, ganancia, rendimiento_pct }
  })
}

export interface ResumenInversion {
  /** Saldo del último movimiento. 0 si no hay ninguno. */
  saldo_actual: number
  /** Suma de todos los depósitos y retiros (positivo = se puso más de lo que se sacó). */
  aportado: number
  /** Suma de las ganancias período a período: lo que generó la inversión, sin los aportes. */
  ganancia_total: number
  /**
   * `ganancia_total` sobre el capital que estuvo invertido (primer saldo + aportes
   * posteriores). `null` si esa base es 0 — no hay porcentaje que calcular.
   */
  rendimiento_pct: number | null
  /** Cantidad de movimientos cargados. */
  cantidad: number
}

/**
 * Resumen de toda la inversión. La base del rendimiento es el **primer saldo más los
 * aportes posteriores**, no el saldo actual: dividir por el saldo final subestimaría el
 * rendimiento de una inversión que creció, porque ese saldo ya incluye la ganancia.
 */
export function resumenInversion(movimientos: Movimiento[]): ResumenInversion {
  const calc = computeMovimientos(movimientos)
  if (calc.length === 0) {
    return { saldo_actual: 0, aportado: 0, ganancia_total: 0, rendimiento_pct: null, cantidad: 0 }
  }

  const saldo_actual = calc[calc.length - 1].monto_actualizado
  const aportado = r2(calc.reduce((s, m) => s + m.movimiento, 0))
  const ganancia_total = r2(calc.reduce((s, m) => s + (m.ganancia ?? 0), 0))

  // Capital expuesto: lo que había al principio + lo que se fue agregando después.
  const aportesPosteriores = calc.slice(1).reduce((s, m) => s + m.movimiento, 0)
  const base = calc[0].monto_actualizado + aportesPosteriores

  return {
    saldo_actual,
    aportado,
    ganancia_total,
    rendimiento_pct: base === 0 ? null : r2((ganancia_total / Math.abs(base)) * 100),
    cantidad: calc.length,
  }
}

/** Serie para el gráfico de evolución: un punto por movimiento, en orden cronológico. */
export function serieEvolucion(movimientos: Movimiento[]): { fecha: string; saldo: number }[] {
  return computeMovimientos(movimientos).map((m) => ({ fecha: m.fecha, saldo: m.monto_actualizado }))
}

/**
 * Normaliza el `moneda_id` que llega en el body. Devuelve `null` (sin moneda declarada) para
 * cualquier valor que no sea un entero positivo — incluido el string vacío del select cuando
 * se elige "Sin especificar".
 */
export function parseMonedaId(valor: any): number | null {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * Mapping camelCase→snake_case de una `Inversion` de Prisma (con `moneda` incluida).
 * Vive en `lib` y no en el `route.ts` porque Next rechaza en build cualquier export de un
 * `route.ts` que no sea un método HTTP, y las dos routes necesitan el mismo mapper.
 */
export function toInversionResponse(row: any) {
  return {
    id: row.id,
    nombre: row.nombre,
    moneda_id: row.monedaId ?? null,
    // Sin moneda declarada la UI la muestra como ARS, que es lo que se venía asumiendo.
    moneda_codigo: row.moneda?.codigo ?? null,
    moneda_simbolo: row.moneda?.simbolo ?? null,
    created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  }
}
