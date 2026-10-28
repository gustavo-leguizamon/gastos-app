import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/** `DELETE /api/promociones/[id]/usos/[usoId]` — quita un uso manual de esa promo. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; usoId: string } }) {
  const promocionId = Number(params.id)
  const usoId = Number(params.usoId)
  if (!Number.isInteger(promocionId) || promocionId <= 0 || !Number.isInteger(usoId) || usoId <= 0) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  }

  // Se busca por los dos ids: borrar el uso de *otra* promo por un id suelto sería un bug.
  const uso = await prisma.promocionUso.findFirst({ where: { id: usoId, promocionId } })
  if (!uso) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await prisma.promocionUso.delete({ where: { id: usoId } })
  return NextResponse.json({ ok: true })
}
