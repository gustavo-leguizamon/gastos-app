import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function toItemResponse(i: any) {
  return {
    id: i.id,
    gasto_id: i.gastoId,
    descripcion: i.descripcion,
    monto: i.monto,
    fecha: i.fecha ?? null,
    cuota_actual: i.cuotaActual ?? null,
    cuotas_totales: i.cuotasTotales ?? null,
    incluye_en_total: i.incluyeEnTotal,
    incluye_en_vencimiento: i.incluyeEnVencimiento,
    lugar_id: i.lugarId ?? null,
    lugar_nombre: i.lugar?.nombre ?? null,
    created_at: i.createdAt.toISOString(),
  }
}

const ITEM_INCLUDE = { lugar: true }

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const items = await prisma.gastoItem.findMany({
    where: { gastoId: Number(params.id) },
    orderBy: { createdAt: 'asc' },
    include: ITEM_INCLUDE,
  })
  return NextResponse.json(items.map(toItemResponse))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const item = await prisma.gastoItem.create({
    data: {
      gastoId: Number(params.id),
      descripcion: body.descripcion,
      monto: body.monto,
      fecha: body.fecha || null,
      cuotaActual: body.cuota_actual ?? null,
      cuotasTotales: body.cuotas_totales ?? null,
      incluyeEnTotal: body.incluye_en_total ?? true,
      incluyeEnVencimiento: body.incluye_en_vencimiento ?? false,
      lugarId: body.lugar_id ?? null,
    },
    include: ITEM_INCLUDE,
  })
  return NextResponse.json(toItemResponse(item), { status: 201 })
}
