import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string; pagoId: string } }) {
  const body = await req.json()
  const pago = await prisma.pago.update({
    where: { id: Number(params.pagoId) },
    data: { fecha: body.fecha, monto: body.monto },
  })
  return NextResponse.json({ id: pago.id, gasto_id: pago.gastoId, fecha: pago.fecha, monto: pago.monto, created_at: pago.createdAt.toISOString() })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; pagoId: string } }) {
  await prisma.pago.delete({ where: { id: Number(params.pagoId) } })
  return NextResponse.json({ ok: true })
}
