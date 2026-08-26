import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseDescripcionMovimiento, toMovimientoResponse } from '@/lib/inversiones-compute'

export async function PUT(req: NextRequest, { params }: { params: { id: string; movId: string } }) {
  const body = await req.json()
  const mov = await prisma.movimiento.update({
    where: { id: Number(params.movId) },
    data: {
      fecha: body.fecha,
      montoActual: Number(body.monto_actual),
      movimiento: Number(body.movimiento ?? 0),
      descripcion: parseDescripcionMovimiento(body.descripcion),
    },
  })
  return NextResponse.json(toMovimientoResponse(mov))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; movId: string } }) {
  await prisma.movimiento.delete({ where: { id: Number(params.movId) } })
  return NextResponse.json({ ok: true })
}
