import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { toGastoResponse } from '@/lib/gastos-compute'
import { resolveConcepto } from '@/lib/conceptos'

const INCLUDE = {
  casa: true,
  moneda: true,
  tarjeta: { include: { cierres: true } },
  concepto: true,
  categoria: true,
  etiquetas: true,
  pagos: { orderBy: { createdAt: 'asc' as const } },
  items: { orderBy: { createdAt: 'asc' as const }, include: { concepto: true, categoria: true, etiquetas: true } },
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const gasto = await prisma.gasto.findUnique({ where: { id: Number(params.id) }, include: INCLUDE })
  if (!gasto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(toGastoResponse(gasto))
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()

  const conceptoId = body.concepto_id ?? await resolveConcepto(prisma, body.descripcion)

  const gasto = await prisma.gasto.update({
    where: { id: Number(params.id) },
    data: {
      casaId: body.casa_id,
      conceptoId,
      fechaVencimiento: body.fecha_vencimiento,
      tipoPago: body.tipo_pago,
      monedaId: body.moneda_id,
      tipoCambio: body.tipo_cambio ?? 1,
      totalMoneda: body.total_moneda,
      totalPagado: body.total_pagado ?? 0,
      pasajeMesSiguiente: body.pasaje_mes_siguiente ?? 0,
      prestamo_a_otro: body.prestamo_a_otro ?? 0,
      tarjetaId: body.tarjeta_id ?? null,
      cuotaActual: body.cuota_actual ?? null,
      cuotasTotales: body.cuotas_totales ?? null,
      mes: body.mes,
      anio: body.anio,
      notas: body.notas || null,
      confirmado: body.confirmado ?? true,
      categoriaId: body.categoria_id ?? null,
      etiquetas: { set: (body.etiqueta_ids ?? []).map((id: number) => ({ id })) },
      esTarjeta: body.es_tarjeta ?? false,
    },
    include: INCLUDE,
  })

  // Sync a los sub-items propagados de tarjeta (los generados por pagos de este gasto): heredan
  // `concepto` + `categoría` + `etiquetas` del gasto fuente, así el resumen de la tarjeta refleja
  // la clasificación actual. Se hace por item porque `etiquetas` (M2M) no soporta `updateMany`.
  try {
    const propagados = await prisma.gastoItem.findMany({
      where: { pago: { gastoId: gasto.id } },
      select: { id: true },
    })
    const etiquetaSet = (body.etiqueta_ids ?? []).map((id: number) => ({ id }))
    await Promise.all(propagados.map(it =>
      prisma.gastoItem.update({
        where: { id: it.id },
        data: { conceptoId, categoriaId: body.categoria_id ?? null, etiquetas: { set: etiquetaSet } },
      }),
    ))
  } catch (err) {
    console.error('Sync gasto→items propagados falló:', err)
  }

  return NextResponse.json(toGastoResponse(gasto))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.gasto.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
