import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseCategoriaBatch } from '@/lib/gastos-batch'

/**
 * PATCH /api/gastos/categorias — asignación masiva de la CATEGORÍA ÚNICA (partición).
 * Body: { gasto_ids: number[], categoria_id: number, action: 'add' | 'remove' }.
 * `add` setea `categoriaId` en todos los gastos indicados; `remove` la limpia (null).
 * Pensado para backfillear la categoría única (que arranca vacía tras la migración).
 * Se ejecuta en una transacción (todo o nada).
 */
export async function PATCH(req: NextRequest) {
  let input
  try {
    input = parseCategoriaBatch(await req.json())
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  const { gasto_ids, categoria_id, action } = input
  const data = action === 'add' ? { categoriaId: categoria_id } : { categoriaId: null }

  await prisma.$transaction(
    gasto_ids.map(id => prisma.gasto.update({ where: { id }, data })),
  )

  return NextResponse.json({ ok: true, updated: gasto_ids.length })
}
