import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseDescripcionMovimiento, toMovimientoResponse } from '@/lib/inversiones-compute'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const movs = await prisma.movimiento.findMany({
    where: { inversionId: Number(params.id) },
    orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
  })
  return NextResponse.json(movs.map(toMovimientoResponse))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const mov = await prisma.movimiento.create({
    data: {
      inversionId: Number(params.id),
      fecha: body.fecha,
      montoActual: Number(body.monto_actual),
      movimiento: Number(body.movimiento ?? 0),
      descripcion: parseDescripcionMovimiento(body.descripcion),
    },
  })
  return NextResponse.json(toMovimientoResponse(mov), { status: 201 })
}
