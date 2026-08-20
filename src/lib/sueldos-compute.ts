// Parte pura de Sueldos: a qué período se imputa un cobro y el cálculo de Neto/Bruto.

import { mesAnioDeFecha } from './ingresos-compute'

/**
 * Período (`mes`/`anio`) al que se imputa un sueldo: los del body si vienen, si no derivados
 * de `fecha`. Así el form puede seguir mandando sólo la fecha, pero queda abierta la puerta
 * a imputar a otro mes (un cobro del 31/7 que corresponde a agosto).
 *
 * `mesAnioDeFecha` parsea el string sin `new Date()`, que interpretaría `YYYY-MM-DD` como UTC
 * y correría el mes en Argentina para un cobro del día 1 o del último día.
 */
export function periodoDe(body: any): { mes: number; anio: number } {
  const mes = Number(body?.mes)
  const anio = Number(body?.anio)
  if (Number.isInteger(mes) && mes >= 1 && mes <= 12 && Number.isInteger(anio) && anio >= 1900 && anio <= 2999) {
    return { mes, anio }
  }
  // Sin período ni fecha válida, 1/2000 es evidentemente incorrecto y salta a la vista en la
  // pantalla, en vez de imputar en silencio al mes actual y quedar mal sin que se note.
  return mesAnioDeFecha(body?.fecha) ?? { mes: 1, anio: 2000 }
}

/**
 * Proporción del bruto que representa el neto pagado. El bruto se muestra como
 * `neto / 0.83`, es decir "cuánto sería el bruto si lo cobrado es el 83%".
 */
export const FACTOR_NETO_BRUTO = 0.83

export interface SueldoCalculable {
  sueldo_ars: number
  sueldo_usd: number
  cotizacion_mep: number
  sueldo_teorico?: number
}

/**
 * `neto = ars + usd × cotizacion_mep`, y `bruto = neto / 0.83`.
 *
 * El tramo en dólares se valúa al **MEP**, que es la cotización a la que efectivamente se
 * puede vender. `cotizacion_bna` se guarda por referencia pero no entra en la cuenta.
 */
export function calcularSueldo(s: SueldoCalculable) {
  const neto = s.sueldo_ars + s.sueldo_usd * s.cotizacion_mep
  return { neto, bruto: neto / FACTOR_NETO_BRUTO }
}

/**
 * `true` si el bruto calculado alcanza al teórico — es lo que decide si la celda va en verde
 * o en rojo. Sin teórico cargado (0) no hay comparación posible y se devuelve `null`.
 */
export function alcanzaTeorico(s: SueldoCalculable): boolean | null {
  const teorico = s.sueldo_teorico ?? 0
  if (teorico <= 0) return null
  return calcularSueldo(s).bruto >= teorico
}
