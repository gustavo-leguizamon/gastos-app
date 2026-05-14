import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const ITEM_INCLUDE = { lugar: true }

function toItemResponse(item: any) {
  return {
    id: item.id,
    gasto_id: item.gastoId,
    descripcion: item.descripcion,
    monto: item.monto,
    fecha: item.fecha ?? null,
    cuota_actual: item.cuotaActual ?? null,
    cuotas_totales: item.cuotasTotales ?? null,
    incluye_en_total: item.incluyeEnTotal,
    incluye_en_vencimiento: item.incluyeEnVencimiento,
    lugar_id: item.lugarId ?? null,
    lugar_nombre: item.lugar?.nombre ?? null,
    created_at: item.createdAt.toISOString(),
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const body = await req.json()
  const item = await prisma.gastoItem.update({
    where: { id: Number(params.itemId) },
    data: {
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
  return NextResponse.json(toItemResponse(item))
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const body = await req.json()
  const item = await prisma.gastoItem.update({
    where: { id: Number(params.itemId) },
    data: {
      ...(body.incluye_en_total !== undefined && { incluyeEnTotal: body.incluye_en_total }),
      ...(body.incluye_en_vencimiento !== undefined && { incluyeEnVencimiento: body.incluye_en_vencimiento }),
    },
    include: ITEM_INCLUDE,
  })
  return NextResponse.json(toItemResponse(item))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  await prisma.gastoItem.delete({ where: { id: Number(params.itemId) } })
  return NextResponse.json({ ok: true })
}
