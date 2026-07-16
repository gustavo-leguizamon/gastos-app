import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { toItemResponse } from '@/lib/gastos-compute'
import { resolveConcepto } from '@/lib/conceptos'

const ITEM_INCLUDE = { concepto: true, categoria: true, etiquetas: true }

export async function PUT(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const body = await req.json()
  const conceptoId = body.concepto_id ?? await resolveConcepto(prisma, body.descripcion)
  const item = await prisma.gastoItem.update({
    where: { id: Number(params.itemId) },
    data: {
      conceptoId,
      monto: body.monto,
      fecha: body.fecha || null,
      cuotaActual: body.cuota_actual ?? null,
      cuotasTotales: body.cuotas_totales ?? null,
      incluyeEnTotal: body.incluye_en_total ?? true,
      incluyeEnVencimiento: body.incluye_en_vencimiento ?? false,
      verificado: body.verificado ?? false,
      categoriaId: body.categoria_id ?? null,
      etiquetas: { set: (body.etiqueta_ids ?? []).map((id: number) => ({ id })) },
    },
    include: ITEM_INCLUDE,
  })
  // Sync con el pago linkeado (si existe): refleja fecha + monto del item en el pago.
  // Si la fecha del item quedó null, mantenemos la fecha actual del pago.
  let syncedPago = false
  if (item.pagoId) {
    try {
      await prisma.pago.update({
        where: { id: item.pagoId },
        data: {
          monto: item.monto,
          ...(item.fecha ? { fecha: item.fecha } : {}),
        },
      })
      syncedPago = true
      console.log(`[PUT item] id=${item.id} sync→pago: id=${item.pagoId} actualizado`)
    } catch (err) {
      console.error('Sync item→pago falló:', err)
    }
  }
  return NextResponse.json({ ...toItemResponse(item), synced_pago: syncedPago })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const body = await req.json()
  const item = await prisma.gastoItem.update({
    where: { id: Number(params.itemId) },
    data: {
      ...(body.incluye_en_total !== undefined && { incluyeEnTotal: body.incluye_en_total }),
      ...(body.incluye_en_vencimiento !== undefined && { incluyeEnVencimiento: body.incluye_en_vencimiento }),
      ...(body.verificado !== undefined && { verificado: body.verificado }),
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
