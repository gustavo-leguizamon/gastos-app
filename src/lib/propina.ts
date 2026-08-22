/**
 * Propina cargada junto al gasto, guardada como un **gasto aparte**.
 *
 * Hay gastos que llevan propina y se registran como dos gastos individuales (el consumo y
 * la propina). Cargarlos por separado obliga a repetir todo el contexto y, cuando la propina
 * viene incluida en el monto pagado, a hacer la resta a mano — que es donde se cuelan los
 * errores y donde después no queda rastro de por qué el monto no cierra con el ticket.
 *
 * Este módulo parte el monto tipeado en los dos gastos que se van a crear. Es puro a
 * propósito: `GastoDialog` sólo orquesta los dos POST, y el preview del form usa exactamente
 * la misma función que decide lo que se guarda (no puede mostrar una cosa y grabar otra).
 *
 * El gasto de propina usa siempre el mismo concepto (`CONCEPTO_PROPINA`), así todas las
 * propinas agregan como una sola unidad en reportes/evolución/estimado, y hereda la categoría
 * del gasto padre para que la propina de una cena siga sumando a "Restaurantes". La
 * trazabilidad al gasto de origen va en las notas, que se ven en la grilla.
 */

import { normalizeNombre } from './conceptos'
import type { GastoFormData } from './types'

/**
 * `'aparte'`: el total tipeado es el consumo y la propina se suma encima.
 * `'incluida'`: el total tipeado es lo que se pagó, propina adentro; el consumo es la resta.
 */
export type ModoPropina = 'aparte' | 'incluida'

export const MODO_PROPINA_DEFAULT: ModoPropina = 'aparte'

/** Concepto único de todos los gastos de propina. */
export const CONCEPTO_PROPINA = 'Propina'

/** Categoría con la que arranca el gasto de propina. El usuario puede cambiarla. */
export const CATEGORIA_PROPINA = 'Propinas'

/**
 * Busca `CATEGORIA_PROPINA` en las categorías ya cargadas por el form, para preseleccionarla
 * al abrir el bloque. El match es case-insensitive y con la misma normalización que el resto
 * de los clasificadores, para que "propinas " o "PROPINAS" resuelvan a la misma fila.
 *
 * `null` si no existe: el select queda en "Sin categoría" y se ve, en vez de crear una
 * categoría en silencio (el alta de categorías es explícita, por el select o el ABM).
 */
export function resolveCategoriaPropina(
  categorias: ReadonlyArray<{ id: number; nombre: string }> | null | undefined,
): number | null {
  const buscado = CATEGORIA_PROPINA.toLowerCase()
  const match = (categorias ?? []).find(c => normalizeNombre(c.nombre ?? '').toLowerCase() === buscado)
  return match?.id ?? null
}

export interface SplitPropina {
  /** Lo que se guarda como `total_moneda` del gasto principal. */
  total_gasto: number
  /** Lo que se guarda como `total_moneda` del gasto de propina. */
  total_propina: number
}

/**
 * Redondeo a centavos. Sólo hace falta en `'incluida'`, donde el total del gasto es una
 * resta de dos floats: 100.10 - 33.37 daría 66.73000000000002. Con montos de dos decimales
 * (que es lo que se puede tipear) el redondeo garantiza `total_gasto + propina === total`.
 */
const redondear = (n: number) => Math.round(n * 100) / 100

/**
 * Parte el total tipeado según el modo. Devuelve `null` cuando no hay propina que registrar
 * — el caller crea un solo gasto, como siempre.
 *
 * No hay pisos: igual que el resto de los montos de la app, la propina admite negativos
 * (una devolución también puede llevar su ajuste de propina).
 */
export function splitPropina(
  total: number,
  propina: number | null | undefined,
  modo: ModoPropina,
): SplitPropina | null {
  const monto = Number(propina)
  if (!Number.isFinite(monto) || monto === 0) return null

  const base = Number.isFinite(Number(total)) ? Number(total) : 0
  return {
    total_gasto: modo === 'incluida' ? redondear(base - monto) : base,
    total_propina: monto,
  }
}

/**
 * Arma el `GastoFormData` del gasto de propina a partir del principal.
 *
 * **Categoría y etiquetas son propias del gasto de propina**, editables en el form:
 * - `propina_categoria_id` manda siempre. El form lo arranca en la categoría `Propinas`
 *   (`resolveCategoriaPropina`), pero se puede cambiar o dejar vacío. Nunca cae a la del
 *   gasto de origen: la categoría es la partición del reporte, y heredarla del rubro
 *   (Restaurantes, Peluquería) volvería la propina invisible como gasto propio.
 * - `propina_etiqueta_ids` en `null` significa **heredar** las del gasto de origen, que es
 *   lo útil por default (una etiqueta como "salida" aplica igual a la propina). Cualquier
 *   valor explícito — incluso `[]` — gana.
 *
 * Hereda el resto del contexto de carga (fecha, casa, medio de pago y tarjeta, moneda, tipo de
 * cambio, período, confirmado y "pagado completo") y descarta lo que no aplica:
 * - **cuotas**: una propina no se financia;
 * - **pasaje / préstamo**: son ajustes del gasto de origen;
 * - **total_pagado**: un pago parcial tipeado a mano es del gasto principal, duplicarlo
 *   en la propina inventaría plata pagada. Con "pagado completo" cada gasto genera su
 *   propio pago por su propio total, que es lo correcto;
 * - **es_tarjeta**: una propina nunca es el resumen de una tarjeta.
 */
export function buildPropinaGasto(data: GastoFormData, split: SplitPropina): GastoFormData {
  const origen = normalizeNombre(data.descripcion ?? '')
  const esPropinaDePropina = origen.toLowerCase() === CONCEPTO_PROPINA.toLowerCase()

  return {
    ...data,
    descripcion: CONCEPTO_PROPINA,
    categoria_id: data.propina_categoria_id ?? null,
    etiqueta_ids: data.propina_etiqueta_ids ?? data.etiqueta_ids ?? [],
    total_moneda: split.total_propina,
    total_pagado: 0,
    pasaje_mes_siguiente: 0,
    prestamo_a_otro: 0,
    cuota_actual: null,
    cuotas_totales: null,
    es_tarjeta: false,
    notas: origen && !esPropinaDePropina ? `Propina de ${origen}` : '',
    propina: 0,
    propina_modo: MODO_PROPINA_DEFAULT,
    propina_categoria_id: null,
    propina_etiqueta_ids: null,
  }
}

export interface GastosAPersistir {
  /** El gasto principal, con el total ya descontado si la propina venía incluida. */
  principal: GastoFormData
  /** El gasto de propina, o `null` si no se cargó ninguna. */
  propina: GastoFormData | null
}

/**
 * Entrada única del alta: convierte lo que se tipeó en el form en los gastos a crear.
 * Sin propina devuelve el `data` tal cual y `propina: null`.
 *
 * Ignora la propina en un resumen de tarjeta: el form esconde el bloque al marcar
 * `es_tarjeta`, pero esconderlo no borra lo ya tipeado, y sin esta guarda un monto que el
 * usuario dejó de ver seguiría creando un gasto.
 */
export function aplicarPropina(data: GastoFormData): GastosAPersistir {
  if (data.es_tarjeta) return { principal: data, propina: null }

  const modo = data.propina_modo ?? MODO_PROPINA_DEFAULT
  const split = splitPropina(data.total_moneda, data.propina, modo)
  if (!split) return { principal: data, propina: null }

  return {
    principal: { ...data, total_moneda: split.total_gasto },
    propina: buildPropinaGasto(data, split),
  }
}
