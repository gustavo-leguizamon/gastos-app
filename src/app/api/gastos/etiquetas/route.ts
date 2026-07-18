import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseEtiquetaBatch } from '@/lib/gastos-batch'

/**
 * PATCH /api/gastos/etiquetas — agregar/quitar una ETIQUETA (corte transversal M2M) en lote.
 * Body: { gasto_ids: number[], etiqueta_id: number, action: 'add' | 'remove' }.
 * `add` conecta la etiqueta a cada gasto; `remove` la desconecta. `connect` es idempotente
 * y `disconnect` es no-op si el gasto no la tenía. También propaga el cambio a los sub-items
 * propagados de tarjeta (linkeados por un pago del gasto), igual que el PUT del gasto.
 * Todo en una transacción (todo o nada).
 */
export async function PATCH(req: NextRequest) {
  let input
  try {
    input = parseEtiquetaBatch(await req.json())
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  const { gasto_ids, etiqueta_id, action } = input
  const relation =
    action === 'add'
      ? { connect: { id: etiqueta_id } }
      : { disconnect: { id: etiqueta_id } }

  // Sub-items propagados de tarjeta de los gastos seleccionados: heredan la etiqueta.
  const propagados = await prisma.gastoItem.findMany({
    where: { pago: { gastoId: { in: gasto_ids } } },
    select: { id: true },
  })

  await prisma.$transaction([
    ...gasto_ids.map(id =>
      prisma.gasto.update({ where: { id }, data: { etiquetas: relation } }),
    ),
    ...propagados.map(it =>
      prisma.gastoItem.update({ where: { id: it.id }, data: { etiquetas: relation } }),
    ),
  ])

  return NextResponse.json({ ok: true, updated: gasto_ids.length })
}
