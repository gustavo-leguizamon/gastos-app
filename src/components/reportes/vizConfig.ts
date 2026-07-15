// Configuración de visualización compartida por los charts de Reportes.
// La paleta categórica es la columna "dark" de la paleta validada del skill dataviz
// (la app corre con theme oscuro). El orden de los slots es el mecanismo de
// separación CVD — no reordenar sin re-validar.

export const CATEGORICAL = [
  '#3987e5', // blue
  '#199e70', // aqua
  '#c98500', // yellow
  '#008300', // green
  '#9085e9', // violet
  '#e66767', // red
  '#d55181', // magenta
  '#d95926', // orange
] as const

// Tonos neutros para buckets que no son una categoría real (no deben impersonar un slot).
export const NEUTRAL_SIN = '#94a3b8' // "Sin categoría"
export const NEUTRAL_OTRAS = '#64748b' // "Otras" (buckets agrupados por overflow)

export function fmtARS(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)
}

// Formato compacto para ejes ($1,2M / $350k) — evita etiquetas largas en los ticks.
export function fmtARSCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${Math.round(n)}`
}
