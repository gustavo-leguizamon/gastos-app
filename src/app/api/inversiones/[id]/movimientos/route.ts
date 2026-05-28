import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function toResponse(m: {
  id: number
  inversionId: number
  fecha: string
  montoActual: number
  movimiento: number
  createdAt: Date
}) {
  return {
    id: m.id,
    inversion_id: m.inversionId,
    fecha: m.fecha,
    monto_actual: m.montoActual,
    movimiento: m.movimiento,
    created_at: m.createdAt.toISOString(),
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const movs = await prisma.movimiento.findMany({
    where: { inversionId: Number(params.id) },
    orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
  })
  return NextResponse.json(movs.map(toResponse))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const mov = await prisma.movimiento.create({
    data: {
      inversionId: Number(params.id),
      fecha: body.fecha,
      montoActual: Number(body.monto_actual),
      movimiento: Number(body.movimiento ?? 0),
    },
  })
  return NextResponse.json(toResponse(mov), { status: 201 })
}
