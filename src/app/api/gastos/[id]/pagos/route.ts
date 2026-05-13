import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const pagos = await prisma.pago.findMany({
    where: { gastoId: Number(params.id) },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(pagos.map(p => ({
    id: p.id,
    gasto_id: p.gastoId,
    fecha: p.fecha,
    monto: p.monto,
    created_at: p.createdAt.toISOString(),
  })))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const pago = await prisma.pago.create({
    data: {
      gastoId: Number(params.id),
      fecha: body.fecha,
      monto: body.monto,
    },
  })
  return NextResponse.json({
    id: pago.id,
    gasto_id: pago.gastoId,
    fecha: pago.fecha,
    monto: pago.monto,
    created_at: pago.createdAt.toISOString(),
  }, { status: 201 })
}
