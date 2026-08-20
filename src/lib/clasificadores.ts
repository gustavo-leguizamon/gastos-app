// Resolución de los dos ejes de clasificación — `Categoria` (partición) y `Etiqueta`
// (corte transversal) — con las mismas garantías que ya tenía `Concepto`.
//
// Por qué existe: hasta acá `POST /api/categorias` y `/api/etiquetas` hacían un `create`
// pelado con el texto crudo, y ninguna de las dos columnas era `@unique`. Como ambas se
// crean inline desde los selects del form, era cuestión de tiempo terminar con "Comida",
// "comida " y "Comida " conviviendo: tres filas que parten el reporte por categoría en
// tres pedazos sin que nada lo señale. Es exactamente el problema que `resolveConcepto`
// resuelve para los conceptos, así que se resuelve igual y no de otra forma.

import { normalizeNombre } from './conceptos'

export { normalizeNombre }

/** Nombre legible de cada eje, para los mensajes de error. */
type Eje = 'categoría' | 'etiqueta'

/**
 * Devuelve el id de la fila cuyo `nombre` matchea `raw` (case-insensitive), creándola si
 * no existe. `delegate` es el delegate de Prisma (`db.categoria` / `db.etiqueta`), para
 * poder usarla dentro de transacciones y testearla con un mock.
 *
 * Normaliza igual que los conceptos (trim + colapso de espacios internos, casing intacto)
 * y reintenta el find ante un P2002, que es la carrera de dos altas simultáneas del mismo
 * nombre.
 */
export async function resolveClasificador(delegate: any, raw: string, eje: Eje): Promise<number> {
  const nombre = normalizeNombre(raw ?? '')
  if (!nombre) throw new Error(`El nombre de la ${eje} no puede estar vacío`)

  const existente = await delegate.findFirst({
    where: { nombre: { equals: nombre, mode: 'insensitive' } },
    select: { id: true },
  })
  if (existente) return existente.id

  try {
    const creado = await delegate.create({ data: { nombre }, select: { id: true } })
    return creado.id
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const reintento = await delegate.findFirst({
        where: { nombre: { equals: nombre, mode: 'insensitive' } },
        select: { id: true },
      })
      if (reintento) return reintento.id
    }
    throw err
  }
}

/** Find-or-create de una categoría por nombre. */
export function resolveCategoria(db: any, raw: string): Promise<number> {
  return resolveClasificador(db.categoria, raw, 'categoría')
}

/** Find-or-create de una etiqueta por nombre. */
export function resolveEtiqueta(db: any, raw: string): Promise<number> {
  return resolveClasificador(db.etiqueta, raw, 'etiqueta')
}

/**
 * Valida el body de un merge (`{ source_id, target_id }`). Devuelve los ids o el mensaje
 * de error, para que las routes de categorías y etiquetas no repitan las mismas guardas.
 */
export function parseMergeBody(body: any): { ok: true; sourceId: number; targetId: number } | { ok: false; error: string } {
  const sourceId = Number(body?.source_id)
  const targetId = Number(body?.target_id)

  if (!Number.isInteger(sourceId) || !Number.isInteger(targetId) || sourceId <= 0 || targetId <= 0) {
    return { ok: false, error: 'source_id y target_id son requeridos' }
  }
  if (sourceId === targetId) {
    return { ok: false, error: 'No se puede fusionar un elemento consigo mismo' }
  }
  return { ok: true, sourceId, targetId }
}
