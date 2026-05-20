import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const ITEM_INCLUDE = { categoria: true }

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
    categoria_id: item.categoriaId ?? null,
    categoria_nombre: item.categoria?.nombre ?? null,
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
      categoriaId: body.categoria_id ?? null,
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
  // Si el item está linkeado a un pago (propagación de tarjeta), borramos el pago — el cascade en GastoItem.pagoId arrastra el item.
  const item = await prisma.gastoItem.findUnique({ where: { id: Number(params.itemId) }, select: { pagoId: true } })
  if (item?.pagoId) {
    await prisma.pago.delete({ where: { id: item.pagoId } })
  } else {
    await prisma.gastoItem.delete({ where: { id: Number(params.itemId) } })
  }
  return NextResponse.json({ ok: true })
}
