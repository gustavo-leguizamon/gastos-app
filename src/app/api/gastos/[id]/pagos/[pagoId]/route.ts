import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string; pagoId: string } }) {
  const body = await req.json()
  const pago = await prisma.pago.update({
    where: { id: Number(params.pagoId) },
    data: { fecha: body.fecha, monto: body.monto },
  })
  // Sync con el sub-item propagado (si existe)
  let syncedItems = 0
  try {
    const result = await prisma.gastoItem.updateMany({
      where: { pagoId: pago.id },
      data: { fecha: pago.fecha, monto: pago.monto },
    })
    syncedItems = result.count
    console.log(`[PUT pago] id=${pago.id} sync→items: ${syncedItems} actualizados`)
  } catch (err) {
    console.error('Sync pago→item falló:', err)
  }
  return NextResponse.json({
    id: pago.id,
    gasto_id: pago.gastoId,
    fecha: pago.fecha,
    monto: pago.monto,
    created_at: pago.createdAt.toISOString(),
    synced_items: syncedItems,
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; pagoId: string } }) {
  await prisma.pago.delete({ where: { id: Number(params.pagoId) } })
  return NextResponse.json({ ok: true })
}
