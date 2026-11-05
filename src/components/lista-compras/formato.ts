import { desdeCantidadBase, type SubunidadDe } from '@/lib/lista-compras-compute'

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

/**
 * Cantidad guardada (en g/ml/un) tal como se ve en pantalla: en kg/l si el artículo lo prefiere
 * (`mostrar_en_multiplo`, sólo en g/ml), si no en su unidad. 2500 g → "2,5 kg" / "2.500 g".
 */
export function fmtCantidad(
  n: number,
  item: { unidad: string; subunidad_de: SubunidadDe | null; mostrar_en_multiplo: boolean },
): string {
  const kg = item.mostrar_en_multiplo && item.subunidad_de != null
  const v = desdeCantidadBase(n, kg)
  return `${v.toLocaleString('es-AR', { maximumFractionDigits: 3 })} ${kg ? item.subunidad_de : item.unidad}`
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
