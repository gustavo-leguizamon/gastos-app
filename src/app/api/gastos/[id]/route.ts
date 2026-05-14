import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function toGastoResponse(g: any) {
  const totalArs = Math.round(g.totalMoneda * g.tipoCambio * 100) / 100
  const pagos = (g.pagos ?? []).map((p: any) => ({
    id: p.id,
    gasto_id: p.gastoId,
    fecha: p.fecha,
    monto: p.monto,
    created_at: p.createdAt?.toISOString(),
  }))
  const totalPagado = Math.round(pagos.reduce((s: number, p: any) => s + p.monto, 0) * 100) / 100
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
    total_ars: totalArs,
    total_pagado: totalPagado,
    total_restante: Math.round((totalArs - totalPagado) * 100) / 100,
    pasaje_mes_siguiente: g.pasajeMesSiguiente,
    prestamo_a_otro: g.prestamo_a_otro,
    tarjeta_id: g.tarjetaId,
    tarjeta_nombre: g.tarjeta?.nombre ?? null,
    tarjeta_banco: g.tarjeta?.banco ?? null,
    cuota_actual: g.cuotaActual ?? null,
    cuotas_totales: g.cuotasTotales ?? null,
    mes: g.mes,
    anio: g.anio,
    notas: g.notas,
    confirmado: g.confirmado,
    pagos,
    items: (g.items ?? []).map((i: any) => ({
      id: i.id,
      gasto_id: i.gastoId,
      descripcion: i.descripcion,
      monto: i.monto,
      fecha: i.fecha ?? null,
      cuota_actual: i.cuotaActual ?? null,
      cuotas_totales: i.cuotasTotales ?? null,
      incluye_en_total: i.incluyeEnTotal,
      incluye_en_vencimiento: i.incluyeEnVencimiento,
      created_at: i.createdAt?.toISOString(),
    })),
  }
}

const INCLUDE = {
  casa: true,
  moneda: true,
  tarjeta: true,
  pagos: { orderBy: { createdAt: 'asc' as const } },
  items: { orderBy: { createdAt: 'asc' as const } },
}

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
      cuotaActual: body.cuota_actual ?? null,
      cuotasTotales: body.cuotas_totales ?? null,
      mes: body.mes,
      anio: body.anio,
      notas: body.notas || null,
      confirmado: body.confirmado ?? true,
    },
    include: INCLUDE,
  })

  return NextResponse.json(toGastoResponse(gasto))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.gasto.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
