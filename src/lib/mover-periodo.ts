// Mover un gasto de período. `mes`/`anio` se tomaban del filtro activo al cargarlo y no eran
// editables por ningún lado: un gasto imputado al mes equivocado sólo se podía arreglar
// borrándolo y recreándolo, perdiendo sus pagos y sus sub-items.

/** Último día de un mes (1-12), contemplando años bisiestos. */
export function ultimoDiaDelMes(mes: number, anio: number): number {
  // El día 0 del mes siguiente es el último del mes pedido; `Date.UTC` evita el corrimiento
  // por timezone que tendría `new Date(anio, mes, 0)` en zonas detrás de UTC.
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate()
}

/**
 * Reubica una `fechaVencimiento` (`YYYY-MM-DD`) en el período `(mes, anio)` **conservando el
 * día**. Si el día no existe en el mes destino se recorta al último (31 de enero → 28/29 de
 * febrero), que es lo que uno espera de "moverlo a febrero" y nunca desborda al mes siguiente.
 *
 * Devuelve `null` si la fecha original no es válida, para que el caller decida.
 */
export function shiftFechaAPeriodo(fecha: string, mes: number, anio: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha ?? '')
  if (!m) return null
  const dia = Number(m[3])
  if (dia < 1 || dia > 31) return null

  const diaFinal = Math.min(dia, ultimoDiaDelMes(mes, anio))
  return `${anio}-${String(mes).padStart(2, '0')}-${String(diaFinal).padStart(2, '0')}`
}

export interface PeriodoBody {
  mes: number
  anio: number
  /** Si además hay que reubicar la `fechaVencimiento` en el nuevo período. */
  moverFecha: boolean
}

/**
 * Valida el body de `PATCH /api/gastos/[id]/periodo`. Devuelve `null` si es inválido, para
 * que la route responda 400 sin tocar la DB.
 *
 * `mover_fecha` viene por separado y no se asume: mover el período es una **reimputación
 * contable** (a qué mes pertenece el gasto) y no siempre implica que la fecha de vencimiento
 * real haya cambiado — un gasto que venció el 31/7 puede imputarse a agosto conservando su
 * fecha. Que lo decida quien mueve.
 */
export function parsePeriodoBody(body: any): PeriodoBody | null {
  const mes = Number(body?.mes)
  const anio = Number(body?.anio)

  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return null
  if (!Number.isInteger(anio) || anio < 1900 || anio > 2999) return null

  return { mes, anio, moverFecha: body?.mover_fecha === true }
}
