// Resolución de Conceptos: el "qué" canónico de un gasto/sub-item (Netflix, Luz, etc.).
// `descripcion` dejó de ser una columna; los write paths reciben texto libre y lo resuelven
// a un `conceptoId` via find-or-create case-insensitive. La normalización (trim + colapso de
// espacios internos) garantiza que "Netflix", "netflix " y "Netflix  HBO" no dupliquen.

/**
 * Normaliza el nombre para *comparar* conceptos: trim + colapso de espacios internos.
 * No cambia mayúsculas (el match es case-insensitive a nivel query); preserva el casing
 * para que el `nombre` almacenado conserve la forma legible que tipeó el usuario.
 */
export function normalizeNombre(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

/**
 * Devuelve el id del concepto cuyo `nombre` matchea `raw` (case-insensitive), creándolo si
 * no existe. Lanza si `raw` queda vacío tras normalizar (un gasto siempre tiene concepto).
 *
 * Acepta el cliente Prisma por parámetro para poder testear con mock y para usarlo dentro de
 * transacciones. Maneja la carrera de "dos creates simultáneos" reintentando el find ante el
 * error de unicidad (P2002).
 */
export async function resolveConcepto(db: any, raw: string): Promise<number> {
  const nombre = normalizeNombre(raw ?? '')
  if (!nombre) throw new Error('El concepto no puede estar vacío')

  const existente = await db.concepto.findFirst({
    where: { nombre: { equals: nombre, mode: 'insensitive' } },
    select: { id: true },
  })
  if (existente) return existente.id

  try {
    const creado = await db.concepto.create({ data: { nombre }, select: { id: true } })
    return creado.id
  } catch (err: any) {
    // Carrera: otro request creó el mismo nombre entre el find y el create.
    if (err?.code === 'P2002') {
      const reintento = await db.concepto.findFirst({
        where: { nombre: { equals: nombre, mode: 'insensitive' } },
        select: { id: true },
      })
      if (reintento) return reintento.id
    }
    throw err
  }
}
