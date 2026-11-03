import { normalizeNombre } from './conceptos'

/** Resultado listo para `NextResponse.json(body, { status })`. */
export interface Resultado {
  status: number
  body: Record<string, unknown>
}

/**
 * Renombra una `Unidad`/`Rubro`. El cambio se ve en todos los artículos que la usan (apuntan
 * por id). Rechaza con 409 un nombre que ya tenga **otra** fila (sin distinguir mayúsculas):
 * renombrar "kg" a "KG" sobre sí misma sí vale, para poder corregir el casing.
 *
 * Recibe el delegate de Prisma (`prisma.unidad` / `prisma.rubro`) para testear con mock.
 */
export async function renombrarCatalogo(model: any, id: number, raw: string): Promise<Resultado> {
  const nombre = normalizeNombre(raw)
  const existente = await model.findUnique({ where: { id } })
  if (!existente) return { status: 404, body: { error: 'No encontrado' } }

  const repetido = await model.findFirst({
    where: { nombre: { equals: nombre, mode: 'insensitive' }, NOT: { id } },
  })
  if (repetido) return { status: 409, body: { error: `Ya existe "${repetido.nombre}"` } }

  try {
    const fila = await model.update({ where: { id }, data: { nombre } })
    return { status: 200, body: { id: fila.id, nombre: fila.nombre } }
  } catch (err: any) {
    // Carrera: otro request creó el mismo nombre entre el find y el update.
    if (err?.code === 'P2002') return { status: 409, body: { error: 'Ya existe una con ese nombre' } }
    throw err
  }
}

/**
 * Edita una unidad: nombre y/o equivalencia (g → kg, ml → l). El nombre pasa por las mismas
 * reglas que `renombrarCatalogo` (409 si lo tiene otra fila); la equivalencia se guarda aparte.
 */
export async function actualizarUnidad(
  model: any,
  id: number,
  patch: { nombre?: string; subunidadDe?: 'kg' | 'l' | null },
): Promise<Resultado> {
  const existente = await model.findUnique({ where: { id } })
  if (!existente) return { status: 404, body: { error: 'No encontrado' } }

  let fila = existente
  if (patch.nombre !== undefined) {
    const r = await renombrarCatalogo(model, id, patch.nombre)
    if (r.status !== 200) return r
    fila = { ...fila, nombre: r.body.nombre }
  }
  if (patch.subunidadDe !== undefined) {
    fila = await model.update({ where: { id }, data: { subunidadDe: patch.subunidadDe } })
  }
  return { status: 200, body: { id: fila.id, nombre: fila.nombre, subunidad_de: fila.subunidadDe ?? null } }
}

/**
 * Borra una `Unidad`/`Rubro` sólo si ningún artículo la usa. En uso → 409 con la cantidad, y
 * no se toca nada: borrarla dejaría artículos sin unidad (o, en el rubro, los pasaría a "sin
 * rubro" en silencio).
 */
export async function borrarCatalogo(model: any, id: number): Promise<Resultado> {
  const fila = await model.findUnique({
    where: { id },
    include: { _count: { select: { articulos: true } } },
  })
  if (!fila) return { status: 404, body: { error: 'No encontrado' } }

  const uso: number = fila._count.articulos
  if (uso > 0) {
    return {
      status: 409,
      body: { error: `No se puede borrar: la usa${uso === 1 ? '' : 'n'} ${uso} artículo${uso === 1 ? '' : 's'}`, uso },
    }
  }
  await model.delete({ where: { id } })
  return { status: 200, body: { ok: true } }
}
