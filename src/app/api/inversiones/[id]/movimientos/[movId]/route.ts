import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string; movId: string } }) {
  const body = await req.json()
  const mov = await prisma.movimiento.update({
    where: { id: Number(params.movId) },
    data: {
      fecha: body.fecha,
      montoActual: Number(body.monto_actual),
      montoExtra: Number(body.monto_extra ?? 0),
    },
  })
  return NextResponse.json({
    id: mov.id,
    inversion_id: mov.inversionId,
    fecha: mov.fecha,
    monto_actual: mov.montoActual,
    monto_extra: mov.montoExtra,
    created_at: mov.createdAt.toISOString(),
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; movId: string } }) {
  await prisma.movimiento.delete({ where: { id: Number(params.movId) } })
  return NextResponse.json({ ok: true })
}
