import { prisma } from '@/lib/db'

/**
 * Existencia de las FK que referencia el body de una promoción (concepto y tarjetas), para
 * que la route responda 400 con un mensaje en vez de un 500 de Prisma. Devuelve el error o
 * `null`. Vive fuera de las routes porque Next no admite exports extra en un `route.ts`.
 */
export async function validarReferenciasPromocion(data: { conceptoId: number | null; tarjetaIds: number[] }) {
  if (data.conceptoId != null) {
    const c = await prisma.concepto.findUnique({ where: { id: data.conceptoId } })
    if (!c) return 'Concepto inexistente'
  }
  if (data.tarjetaIds.length) {
    const n = await prisma.tarjeta.count({ where: { id: { in: data.tarjetaIds } } })
    if (n !== data.tarjetaIds.length) return 'Alguna tarjeta no existe'
  }
  return null
}
