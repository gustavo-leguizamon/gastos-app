/**
 * Signo de un monto tipeado en un input numérico.
 *
 * En el celular el teclado numérico (`type="number"`) muchas veces no trae la tecla "-", así que
 * los campos de monto que admiten negativos tienen un botón ± (`AppMontoField`). Estas funciones
 * deciden qué valor queda; trabajan sobre el string tal como está tipeado para no perder los
 * decimales que el usuario escribió ("12.50" → "-12.50", no "-12.5").
 */

/** `true` si el valor representa un número distinto de 0 (los únicos a los que un signo les cambia algo). */
export function tieneMagnitud(value: string | number | null | undefined): boolean {
  if (value == null) return false
  const s = String(value).trim()
  if (s === '' || s === '-') return false
  const n = Number(s)
  return Number.isFinite(n) && n !== 0
}

/**
 * Invierte el signo de un monto. Devuelve `null` si no hay nada que invertir (vacío, 0 o inválido):
 * ahí el componente deja el signo "pendiente" y lo aplica al primer número que se tipee.
 */
export function invertirSigno(value: string | number | null | undefined): string | null {
  if (!tieneMagnitud(value)) return null
  const s = String(value).trim()
  return s.startsWith('-') ? s.slice(1) : `-${s}`
}

/**
 * Aplica un signo negativo pendiente al valor recién tipeado. Si el valor todavía no tiene magnitud
 * (vacío o 0) o ya es negativo, lo devuelve tal cual.
 */
export function aplicarNegativo(value: string): string {
  if (!tieneMagnitud(value)) return value
  const s = value.trim()
  return s.startsWith('-') ? s : `-${s}`
}

/** `true` si el monto es negativo. */
export function esNegativo(value: string | number | null | undefined): boolean {
  return tieneMagnitud(value) && Number(String(value).trim()) < 0
}
