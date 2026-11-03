import { normalizeNombre } from './conceptos'
import { referenciaDe, resumenCompras, toItemResponse, type ItemResponse } from './lista-compras-compute'

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

/** Lo que `toItemResponse` necesita de una línea: su artículo (con unidad y rubro) y sus compras por fecha. */
export const INCLUDE_ITEM = {
  articulo: { include: { unidad: true, rubro: true } },
  compras: { orderBy: [{ fecha: 'asc' as const }, { id: 'asc' as const }] },
}

/**
 * Recalcula lo llevado y el precio de una línea a partir de sus compras: `cantidadComprada` =
 * suma y `precioUnitario` = promedio ponderado (ver `resumenCompras`). Si ninguna compra tiene
 * precio **no toca** el precio de la línea (no borra lo cargado a mano). Se llama después de cada
 * alta, edición o baja de una compra.
 */
export async function recalcularLinea(db: any, itemId: number): Promise<void> {
  const compras = await db.listaCompraCompra.findMany({ where: { itemId }, select: { cantidad: true, precioUnitario: true } })
  const { cantidadComprada, precioPromedio } = resumenCompras(compras)
  await db.listaCompraItem.update({
    where: { id: itemId },
    data: { cantidadComprada, ...(precioPromedio != null ? { precioUnitario: precioPromedio } : {}) },
  })
}

/** La línea tal como la devuelve la API, con su referencia de precio. `null` si no existe. */
export async function cargarItemResponse(db: any, id: number): Promise<ItemResponse | null> {
  const fila = await db.listaCompraItem.findUnique({ where: { id }, include: INCLUDE_ITEM })
  if (!fila) return null
  const historico = await db.listaCompraItem.findMany({
    where: { articuloId: fila.articuloId, precioUnitario: { not: null }, ...antesDe(fila.mes, fila.anio) },
    select: { cantidad: true, precioUnitario: true, mes: true, anio: true },
  })
  return toItemResponse(fila, referenciaDe(historico, { mes: fila.mes, anio: fila.anio }))
}

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
