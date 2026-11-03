import { normalizeNombre } from './conceptos'

/** Período anterior estricto (mes/año) como filtro de Prisma. */
export function antesDe(mes: number, anio: number) {
  return { OR: [{ anio: { lt: anio } }, { anio, mes: { lt: mes } }] }
}

/**
 * Id del artículo cuyo nombre matchea `raw` (case-insensitive), creándolo con la unidad y el
 * rubro dados si no existe. Si ya existe se conserva tal cual: la unidad/rubro de un alta no
 * pisan lo que el artículo ya tenía. Mismo patrón que `resolveConcepto`.
 */
export async function resolveArticulo(
  db: any,
  data: { nombre: string; unidadId: number; rubroId: number | null },
): Promise<number> {
  const nombre = normalizeNombre(data.nombre)
  const buscar = () =>
    db.articulo.findFirst({ where: { nombre: { equals: nombre, mode: 'insensitive' } }, select: { id: true } })

  const existente = await buscar()
  if (existente) return existente.id
  try {
    const creado = await db.articulo.create({
      data: { nombre, unidadId: data.unidadId, rubroId: data.rubroId },
      select: { id: true },
    })
    return creado.id
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const reintento = await buscar()
      if (reintento) return reintento.id
    }
    throw err
  }
}

/** Incluye lo que `toItemResponse` necesita del artículo: su unidad y su rubro. */
export const INCLUDE_ARTICULO = { articulo: { include: { unidad: true, rubro: true } } } as const

/**
 * Find-or-create case-insensitive de una `Unidad`/`Rubro` por nombre. Devuelve la fila y si
 * se creó (para que la route responda 201 vs 200). Maneja la carrera de dos altas
 * simultáneas reintentando el find ante P2002.
 */
export async function resolveCatalogo(
  model: any,
  raw: string,
  /** Campos extra al crear (no se tocan si la fila ya existe). */
  extra: Record<string, unknown> = {},
): Promise<{ fila: { id: number; nombre: string }; creada: boolean }> {
  const nombre = normalizeNombre(raw)
  const buscar = () => model.findFirst({ where: { nombre: { equals: nombre, mode: 'insensitive' } } })
  const existente = await buscar()
  if (existente) return { fila: existente, creada: false }
  try {
    return { fila: await model.create({ data: { nombre, ...extra } }), creada: true }
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const reintento = await buscar()
      if (reintento) return { fila: reintento, creada: false }
    }
    throw err
  }
}
