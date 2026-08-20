import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseMergeBody } from '@/lib/clasificadores'

/**
 * `POST /api/categorias/merge` — fusiona la categoría `source_id` en `target_id`.
 *
 * La categoría es una **FK única** en `Gasto` y `GastoItem`, así que fusionar es reapuntar
 * las dos columnas y borrar el origen. Es la herramienta para limpiar los duplicados que
 * quedaron de antes de que `nombre` fuera `@unique` ("Comida" vs "comida ").
 *
 * Espejo de `POST /api/conceptos/merge`.
 */
export async function POST(req: NextRequest) {
  const parsed = parseMergeBody(await req.json())
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { sourceId, targetId } = parsed

  const [source, target] = await Promise.all([
    prisma.categoria.findUnique({ where: { id: sourceId } }),
    prisma.categoria.findUnique({ where: { id: targetId } }),
  ])
  if (!source) return NextResponse.json({ error: 'Categoría origen no encontrada' }, { status: 404 })
  if (!target) return NextResponse.json({ error: 'Categoría destino no encontrada' }, { status: 404 })

  const [gastos, items] = await prisma.$transaction([
    prisma.gasto.updateMany({ where: { categoriaId: sourceId }, data: { categoriaId: targetId } }),
    prisma.gastoItem.updateMany({ where: { categoriaId: sourceId }, data: { categoriaId: targetId } }),
    prisma.categoria.delete({ where: { id: sourceId } }),
  ])

  return NextResponse.json({
    ok: true,
    target_id: targetId,
    moved_gastos: gastos.count,
    moved_items: items.count,
  })
}
