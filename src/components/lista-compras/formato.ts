export function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

/**
 * Precio para un campo editable, redondeado a centavos: el promedio ponderado guardado suele
 * tener muchos decimales (5190.178571 → "5190.18"). Sólo es de pantalla; lo guardado no cambia.
 */
export function precioCampo(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** Hoy como `YYYY-MM-DD` en la fecha LOCAL (`toISOString()` devuelve UTC y se corre un día de noche en Argentina). */
export function hoyLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** `"1,5"` o `"1.5"` → 1.5; vacío → `null`; basura → `NaN`. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.')
  return t === '' ? null : Number(t)
}
