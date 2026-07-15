/**
 * Lógica pura para operaciones masivas sobre gastos.
 *
 * `parseCategoriaBatch` valida y normaliza el body de `PATCH /api/gastos/categorias`
 * (agregar/quitar una misma categoría a varios gastos a la vez). Se extrae del route
 * handler para poder testear la validación sin Prisma/Next.
 */

export type CategoriaBatchAction = 'add' | 'remove'

export interface CategoriaBatchInput {
  gasto_ids: number[]
  categoria_id: number
  action: CategoriaBatchAction
}

export function parseCategoriaBatch(body: any): CategoriaBatchInput {
  const action = body?.action
  if (action !== 'add' && action !== 'remove') {
    throw new Error('action debe ser "add" o "remove"')
  }

  const categoriaId = Number(body?.categoria_id)
  if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
    throw new Error('categoria_id inválido')
  }

  const raw = body?.gasto_ids
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('gasto_ids debe ser un array no vacío')
  }

  const ids = raw.map(Number)
  if (ids.some(id => !Number.isInteger(id) || id <= 0)) {
    throw new Error('gasto_ids contiene un id inválido')
  }

  return {
    gasto_ids: Array.from(new Set(ids)),
    categoria_id: categoriaId,
    action,
  }
}
