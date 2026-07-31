/**
 * Lógica pura para operaciones masivas sobre gastos.
 *
 * `parseCategoriaBatch` / `parseEtiquetaBatch` validan y normalizan el body de los
 * endpoints de edición masiva (`PATCH /api/gastos/categorias` y `/api/gastos/etiquetas`):
 * asignar/quitar la categoría única o agregar/quitar una etiqueta a varios gastos a la vez.
 * `parseGastoIdsBatch` valida el body del borrado masivo (`DELETE /api/gastos`).
 * Se extraen del route handler para poder testear la validación sin Prisma/Next.
 */

export type BatchAction = 'add' | 'remove'
// Alias histórico.
export type CategoriaBatchAction = BatchAction

export interface CategoriaBatchInput {
  gasto_ids: number[]
  categoria_id: number
  action: BatchAction
}

export interface EtiquetaBatchInput {
  gasto_ids: number[]
  etiqueta_id: number
  action: BatchAction
}

export interface GastoIdsBatchInput {
  gasto_ids: number[]
}

interface ParsedBatch {
  gasto_ids: number[]
  target_id: number
  action: BatchAction
}

/** Valida `{ gasto_ids }`: array no vacío de ids positivos, con coerción a number y dedup. */
export function parseGastoIdsBatch(body: any): GastoIdsBatchInput {
  const raw = body?.gasto_ids
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('gasto_ids debe ser un array no vacío')
  }

  const ids = raw.map(Number)
  if (ids.some(id => !Number.isInteger(id) || id <= 0)) {
    throw new Error('gasto_ids contiene un id inválido')
  }

  return { gasto_ids: Array.from(new Set(ids)) }
}

/** Valida `{ gasto_ids, <idKey>, action }`. `idKey` es el nombre del campo id en el body. */
function parseBatch(body: any, idKey: string): ParsedBatch {
  const action = body?.action
  if (action !== 'add' && action !== 'remove') {
    throw new Error('action debe ser "add" o "remove"')
  }

  const targetId = Number(body?.[idKey])
  if (!Number.isInteger(targetId) || targetId <= 0) {
    throw new Error(`${idKey} inválido`)
  }

  const { gasto_ids } = parseGastoIdsBatch(body)

  return { gasto_ids, target_id: targetId, action }
}

export function parseCategoriaBatch(body: any): CategoriaBatchInput {
  const { gasto_ids, target_id, action } = parseBatch(body, 'categoria_id')
  return { gasto_ids, categoria_id: target_id, action }
}

export function parseEtiquetaBatch(body: any): EtiquetaBatchInput {
  const { gasto_ids, target_id, action } = parseBatch(body, 'etiqueta_id')
  return { gasto_ids, etiqueta_id: target_id, action }
}
