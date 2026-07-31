/**
 * Cuotas en un solo campo de texto: el alta de un gasto acepta `"3/12"` en vez de un toggle
 * más dos inputs numéricos. Vacío significa "sin cuotas" (ambos campos en null).
 *
 * Atajo: un solo número `"12"` se interpreta como `1/12` — el caso de cargar una compra en
 * cuotas el mes en que se hizo, que es cuando efectivamente se tipea.
 */

export type ParseCuotasResult =
  | { ok: true; cuota_actual: number | null; cuotas_totales: number | null }
  | { ok: false; error: string }

const SIN_CUOTAS = { ok: true as const, cuota_actual: null, cuotas_totales: null }

/** Formatea el par de cuotas para mostrarlo en el input (`""` si no hay cuotas). */
export function formatCuotas(cuotaActual: number | null | undefined, cuotasTotales: number | null | undefined): string {
  if (cuotaActual == null && cuotasTotales == null) return ''
  if (cuotaActual != null && cuotasTotales != null) return `${cuotaActual}/${cuotasTotales}`
  // Par incompleto (dato viejo): se muestra lo que haya sin inventar el otro lado.
  return cuotaActual != null ? `${cuotaActual}/` : `/${cuotasTotales}`
}

/** Parsea `"3/12"` (o `"12"` → 1/12) al par de cuotas del formulario. */
export function parseCuotas(raw: string | null | undefined): ParseCuotasResult {
  const s = (raw ?? '').trim()
  if (!s) return SIN_CUOTAS

  const partes = s.split('/').map(p => p.trim())
  if (partes.length > 2) return { ok: false, error: 'Formato: 3/12' }

  const nums = partes.map(p => (p === '' ? null : Number(p)))
  if (nums.some(n => n !== null && (!Number.isInteger(n) || n < 1))) {
    return { ok: false, error: 'Deben ser enteros >= 1' }
  }

  // Un solo número: es el total y arranca en la cuota 1.
  if (partes.length === 1) {
    const total = nums[0]
    if (total == null) return SIN_CUOTAS
    return { ok: true, cuota_actual: 1, cuotas_totales: total }
  }

  const [actual, total] = nums
  if (actual == null || total == null) return { ok: false, error: 'Formato: 3/12' }
  if (actual > total) return { ok: false, error: 'La cuota no puede superar el total' }

  return { ok: true, cuota_actual: actual, cuotas_totales: total }
}
