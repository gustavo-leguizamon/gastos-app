import { shiftMonth } from './fechas'
import { shiftFechaAPeriodo } from './mover-periodo'

export interface CuotaFutura {
  mes: number
  anio: number
  fechaVencimiento: string
  cuotaActual: number
}

/**
 * Cuotas que faltan de un gasto **de débito** en cuotas, una por mes siguiente hasta la última.
 * Una cuota 2/6 en marzo genera 3/6 en abril … 6/6 en julio.
 *
 * Sólo aplica a débito (`tipoPago === 'D'`): las cuotas de crédito viven en el resumen de la
 * tarjeta. Devuelve `[]` sin cuotas, con cuotas inválidas, o si ya es la última.
 * El día de vencimiento se conserva, recortado al último del mes destino.
 */
export function cuotasFuturasDebito(g: {
  tipoPago: string
  cuotaActual: number | null | undefined
  cuotasTotales: number | null | undefined
  mes: number
  anio: number
  fechaVencimiento: string
}): CuotaFutura[] {
  if (g.tipoPago !== 'D') return []
  const { cuotaActual, cuotasTotales } = g
  if (!Number.isInteger(cuotaActual) || !Number.isInteger(cuotasTotales)) return []
  if ((cuotaActual as number) < 1 || (cuotaActual as number) >= (cuotasTotales as number)) return []

  const out: CuotaFutura[] = []
  for (let n = 1; (cuotaActual as number) + n <= (cuotasTotales as number); n++) {
    const { mes, anio } = shiftMonth(g.mes, g.anio, n)
    const fecha = shiftFechaAPeriodo(g.fechaVencimiento, mes, anio)
    if (!fecha) return []
    out.push({ mes, anio, fechaVencimiento: fecha, cuotaActual: (cuotaActual as number) + n })
  }
  return out
}
