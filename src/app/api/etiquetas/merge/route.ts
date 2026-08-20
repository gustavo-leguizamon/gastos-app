import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseMergeBody } from '@/lib/clasificadores'

/**
 * `POST /api/etiquetas/merge` — fusiona la etiqueta `source_id` en `target_id`.
 *
 * A diferencia de la categoría (FK única, se reapunta con un `updateMany`), la etiqueta es
 * **M2M**: hay que conectar el destino en cada gasto/sub-ítem que tenga el origen. Se hace
 * fila por fila porque Prisma no soporta `updateMany` sobre relaciones M2M.
 *
 * El `connect` es **idempotente**: una fila que ya tenía las dos etiquetas queda con una
 * sola, sin romper por clave duplicada. Las filas de la tabla intermedia del origen se van
 * solas al borrarlo, así que no hace falta desconectarlo a mano.
 */
export async function POST(req: NextRequest) {
  const parsed = parseMergeBody(await req.json())
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { sourceId, targetId } = parsed

  const [source, target] = await Promise.all([
    prisma.etiqueta.findUnique({
      where: { id: sourceId },
      include: {
        gastos: { select: { id: true } },
        items: { select: { id: true } },
      },
    }),
    prisma.etiqueta.findUnique({ where: { id: targetId } }),
  ])
  if (!source) return NextResponse.json({ error: 'Etiqueta origen no encontrada' }, { status: 404 })
  if (!target) return NextResponse.json({ error: 'Etiqueta destino no encontrada' }, { status: 404 })

  await prisma.$transaction([
    ...source.gastos.map(g =>
      prisma.gasto.update({ where: { id: g.id }, data: { etiquetas: { connect: { id: targetId } } } }),
    ),
    ...source.items.map(i =>
      prisma.gastoItem.update({ where: { id: i.id }, data: { etiquetas: { connect: { id: targetId } } } }),
    ),
    prisma.etiqueta.delete({ where: { id: sourceId } }),
  ])

  return NextResponse.json({
    ok: true,
    target_id: targetId,
    moved_gastos: source.gastos.length,
    moved_items: source.items.length,
  })
}
