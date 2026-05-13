import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function toGastoResponse(g: any) {
  const totalArs = g.totalMoneda * g.tipoCambio
  return {
    id: g.id,
    casa_id: g.casaId,
    casa_nombre: g.casa?.nombre,
    descripcion: g.descripcion,
    fecha_vencimiento: g.fechaVencimiento,
    tipo_pago: g.tipoPago,
    moneda_id: g.monedaId,
    moneda_codigo: g.moneda?.codigo,
    moneda_simbolo: g.moneda?.simbolo,
    tipo_cambio: g.tipoCambio,
    total_moneda: g.totalMoneda,
    total_ars: Math.round(totalArs * 100) / 100,
    total_pagado: g.totalPagado,
    total_restante: Math.round((totalArs - g.totalPagado) * 100) / 100,
    pasaje_mes_siguiente: g.pasajeMesSiguiente,
    prestamo_a_otro: g.prestamo_a_otro,
    tarjeta_id: g.tarjetaId,
    tarjeta_nombre: g.tarjeta?.nombre ?? null,
    mes: g.mes,
    anio: g.anio,
    notas: g.notas,
  }
}

const INCLUDE = { casa: true, moneda: true, tarjeta: true }

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const gasto = await prisma.gasto.findUnique({ where: { id: Number(params.id) }, include: INCLUDE })
  if (!gasto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(toGastoResponse(gasto))
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()

  const gasto = await prisma.gasto.update({
    where: { id: Number(params.id) },
    data: {
      casaId: body.casa_id,
      descripcion: body.descripcion,
      fechaVencimiento: body.fecha_vencimiento,
      tipoPago: body.tipo_pago,
      monedaId: body.moneda_id,
      tipoCambio: body.tipo_cambio ?? 1,
      totalMoneda: body.total_moneda,
      totalPagado: body.total_pagado ?? 0,
      pasajeMesSiguiente: body.pasaje_mes_siguiente ?? 0,
      prestamo_a_otro: body.prestamo_a_otro ?? 0,
      tarjetaId: body.tarjeta_id ?? null,
      mes: body.mes,
      anio: body.anio,
      notas: body.notas || null,
    },
    include: INCLUDE,
  })

  return NextResponse.json(toGastoResponse(gasto))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.gasto.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
