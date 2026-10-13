/**
 * Aviso de gasto repetido al cargar.
 *
 * Es fácil no acordarse si un gasto ya se cargó. Antes de guardar un alta se lo compara
 * contra los gastos del mismo período, y si hay uno equivalente se le pregunta al usuario
 * si lo carga igual (hay gastos que de verdad se repiten) o cancela.
 *
 * Es sólo un aviso, no una restricción: nunca bloquea y no vive en el servidor, así que
 * ningún otro write path (copiar, pagos, API directa) se ve afectado.
 *
 * Dos gastos son "el mismo" si coinciden concepto (case-insensitive, con la misma
 * normalización que `Concepto`), período (`mes`/`anio`), moneda y monto. Dejamos afuera
 * fecha, casa, tarjeta y notas a propósito: el olvido típico es cargarlo con otra fecha o
 * medio de pago, y eso es justo lo que no tiene que esconder el aviso.
 */

import { normalizeNombre } from './conceptos'
import type { Gasto, GastoFormData } from './types'

const clave = (descripcion: string) => normalizeNombre(descripcion ?? '').toLowerCase()

/**
 * Gastos existentes equivalentes al que se está por cargar. Vacío = no hay repetido.
 * Los resúmenes de tarjeta (`es_tarjeta`) se ignoran en ambos lados: su monto lo arman los
 * consumos y no se tipea, así que un match ahí sería ruido.
 */
export function buscarDuplicados(
  nuevo: Pick<GastoFormData, 'descripcion' | 'mes' | 'anio' | 'moneda_id' | 'total_moneda' | 'es_tarjeta'>,
  existentes: ReadonlyArray<Pick<Gasto, 'id' | 'descripcion' | 'mes' | 'anio' | 'moneda_id' | 'total_moneda' | 'es_tarjeta'>>,
): typeof existentes[number][] {
  if (nuevo.es_tarjeta) return []
  const desc = clave(nuevo.descripcion)
  if (!desc) return []
  return existentes.filter(g =>
    !g.es_tarjeta &&
    g.mes === nuevo.mes &&
    g.anio === nuevo.anio &&
    g.moneda_id === nuevo.moneda_id &&
    Number(g.total_moneda) === Number(nuevo.total_moneda) &&
    clave(g.descripcion) === desc,
  )
}
