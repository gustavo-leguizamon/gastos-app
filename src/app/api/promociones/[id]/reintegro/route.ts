import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseReintegroBody, toReintegroResponse } from '@/lib/promociones-compute'

/**
 * `PUT /api/promociones/[id]/reintegro` — carga (o cambia) el **vencimiento del reintegro** de la
 * promo en un mes: `{ mes, anio, vence_el, utilizado }`. Upsert sobre `(promocion, mes, anio)`.
 *
 * Sin fecha y sin marca de utilizado no queda nada que guardar: se borra la fila en vez de dejar
 * una vacía, así "quitar el vencimiento" no acumula basura. Devuelve `null` en ese caso.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  }
  const data = parseReintegroBody(await req.json())
  if (!data) return NextResponse.json({ error: 'Datos del vencimiento inválidos' }, { status: 400 })

  const existe = await prisma.promocion.findUnique({ where: { id } })
  if (!existe) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const where = { promocionId_mes_anio: { promocionId: id, mes: data.mes, anio: data.anio } }

  if (!data.venceEl && !data.utilizado) {
    await prisma.promocionReintegro.deleteMany({ where: { promocionId: id, mes: data.mes, anio: data.anio } })
    return NextResponse.json(null)
  }

  const fila = await prisma.promocionReintegro.upsert({
    where,
    create: { promocionId: id, mes: data.mes, anio: data.anio, venceEl: data.venceEl, utilizado: data.utilizado },
    update: { venceEl: data.venceEl, utilizado: data.utilizado },
  })
  return NextResponse.json(toReintegroResponse(fila))
}
