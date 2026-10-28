import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseGastoIdsBatch } from '@/lib/gastos-batch'

/**
 * `POST /api/promociones/[id]/asociar` — asocia (`asociar: true`) o desasocia (`false`) gastos
 * de la promo. Body: `{ gasto_ids, asociar }`.
 *
 * Desasociar sólo toca los gastos que están asociados a **esta** promo: un id suelto no debe
 * poder soltar el gasto de otra. Asociar pisa la asociación anterior (un gasto cuenta para una
 * sola promo).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id inválido' }, { status: 400 })

  const body = await req.json()
  let ids: number[]
  try {
    ids = parseGastoIdsBatch(body).gasto_ids
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
  if (typeof body?.asociar !== 'boolean') {
    return NextResponse.json({ error: 'asociar (boolean) es requerido' }, { status: 400 })
  }

  const promo = await prisma.promocion.findUnique({ where: { id } })
  if (!promo) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const r = body.asociar
    ? await prisma.gasto.updateMany({ where: { id: { in: ids } }, data: { promocionId: id } })
    : await prisma.gasto.updateMany({ where: { id: { in: ids }, promocionId: id }, data: { promocionId: null } })

  return NextResponse.json({ ok: true, actualizados: r.count })
}
