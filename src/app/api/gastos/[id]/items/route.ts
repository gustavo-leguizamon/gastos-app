import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { toItemResponse } from '@/lib/gastos-compute'
import { resolveConcepto } from '@/lib/conceptos'

const ITEM_INCLUDE = { concepto: true, categoria: true, etiquetas: true }

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
  const conceptoId = body.concepto_id ?? await resolveConcepto(prisma, body.descripcion)
  const item = await prisma.gastoItem.create({
    data: {
      gastoId: Number(params.id),
      conceptoId,
      monto: body.monto,
      fecha: body.fecha || null,
      cuotaActual: body.cuota_actual ?? null,
      cuotasTotales: body.cuotas_totales ?? null,
      incluyeEnTotal: body.incluye_en_total ?? true,
      incluyeEnVencimiento: body.incluye_en_vencimiento ?? false,
      categoriaId: body.categoria_id ?? null,
      etiquetas: { connect: (body.etiqueta_ids ?? []).map((id: number) => ({ id })) },
    },
    include: ITEM_INCLUDE,
  })
  return NextResponse.json(toItemResponse(item), { status: 201 })
}
