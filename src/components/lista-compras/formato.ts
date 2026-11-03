export function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

/** `"1,5"` o `"1.5"` → 1.5; vacío → `null`; basura → `NaN`. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.')
  return t === '' ? null : Number(t)
}
