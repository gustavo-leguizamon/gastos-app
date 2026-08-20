import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * `DELETE /api/presupuestos/[id]` — saca el tope de una categoría en ese período.
 *
 * Borrar la fila no es lo mismo que ponerla en 0: sin fila la categoría queda **sin
 * presupuesto** (no se compara contra nada), mientras que un 0 dice "acá no se gasta" y
 * cualquier gasto lo excede.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  }

  const existe = await prisma.presupuesto.findUnique({ where: { id } })
  if (!existe) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await prisma.presupuesto.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
