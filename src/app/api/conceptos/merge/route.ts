import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// POST /api/conceptos/merge — fusiona el concepto `source_id` en `target_id`:
// reasigna todos los gastos y sub-items del origen al destino y borra el origen.
// Herramienta de limpieza de duplicados (ej: "Netflix" y "netflix " que quedaron separados).
export async function POST(req: NextRequest) {
  const body = await req.json()
  const sourceId = Number(body.source_id)
  const targetId = Number(body.target_id)

  if (!sourceId || !targetId) {
    return NextResponse.json({ error: 'source_id y target_id son requeridos' }, { status: 400 })
  }
  if (sourceId === targetId) {
    return NextResponse.json({ error: 'No se puede fusionar un concepto consigo mismo' }, { status: 400 })
  }

  const target = await prisma.concepto.findUnique({ where: { id: targetId } })
  if (!target) return NextResponse.json({ error: 'Concepto destino no encontrado' }, { status: 404 })

  // Las promos vinculadas al origen: al borrarlo la tabla puente lo suelta (cascade) y la promo
  // dejaría de sugerirse sin avisar. Se les conecta el destino (idempotente si ya lo tenían).
  const promos = await prisma.promocion.findMany({
    where: { conceptos: { some: { id: sourceId } } },
    select: { id: true },
  })

  const [gastos, items] = await prisma.$transaction([
    prisma.gasto.updateMany({ where: { conceptoId: sourceId }, data: { conceptoId: targetId } }),
    prisma.gastoItem.updateMany({ where: { conceptoId: sourceId }, data: { conceptoId: targetId } }),
    ...promos.map(p =>
      prisma.promocion.update({ where: { id: p.id }, data: { conceptos: { connect: { id: targetId } } } }),
    ),
    prisma.concepto.delete({ where: { id: sourceId } }),
  ])

  return NextResponse.json({
    ok: true,
    target_id: targetId,
    moved_gastos: gastos.count,
    moved_items: items.count,
  })
}
