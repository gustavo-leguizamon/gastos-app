import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { toGastoResponse } from '@/lib/gastos-compute'
import { resolveConcepto } from '@/lib/conceptos'

const INCLUDE = {
  casa: true,
  moneda: true,
  tarjeta: { include: { cierres: true } },
  concepto: true,
  categorias: true,
  pagos: { orderBy: { createdAt: 'asc' as const } },
  items: { orderBy: { createdAt: 'asc' as const }, include: { concepto: true, categorias: true } },
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
      categorias: { set: (body.categoria_ids ?? []).map((id: number) => ({ id })) },
      esTarjeta: body.es_tarjeta ?? false,
    },
    include: INCLUDE,
  })

  // Sync del concepto a los sub-items propagados de tarjeta: el sub-item se generó con el
  // `conceptoId` del gasto fuente. Si el gasto pasó a apuntar a otro concepto, reflejarlo en
  // todos los items cuyo pago pertenece a este gasto. (Renombrar el concepto en sí no necesita
  // esto: la `descripcion` derivada se actualiza sola.)
  try {
    await prisma.gastoItem.updateMany({
      where: { pago: { gastoId: gasto.id } },
      data: { conceptoId },
    })
  } catch (err) {
    console.error('Sync concepto gasto→items propagados falló:', err)
  }

  return NextResponse.json(toGastoResponse(gasto))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.gasto.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
