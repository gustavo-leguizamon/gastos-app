import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseCategoriaBatch } from '@/lib/gastos-batch'

/**
 * PATCH /api/gastos/categorias — edición masiva de categorías.
 * Body: { gasto_ids: number[], categoria_id: number, action: 'add' | 'remove' }.
 * Agrega o quita una misma categoría a todos los gastos indicados (relación m2m
 * vía connect/disconnect). connect es idempotente; disconnect de algo no asignado
 * es no-op. Se ejecuta en una transacción (todo o nada).
 */
export async function PATCH(req: NextRequest) {
  let input
  try {
    input = parseCategoriaBatch(await req.json())
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  const { gasto_ids, categoria_id, action } = input
  const relation =
    action === 'add'
      ? { connect: { id: categoria_id } }
      : { disconnect: { id: categoria_id } }

  await prisma.$transaction(
    gasto_ids.map(id =>
      prisma.gasto.update({
        where: { id },
        data: { categorias: relation },
      }),
    ),
  )

  return NextResponse.json({ ok: true, updated: gasto_ids.length })
}
