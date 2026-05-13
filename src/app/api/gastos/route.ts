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
    created_at: g.createdAt?.toISOString(),
    updated_at: g.updatedAt?.toISOString(),
  }
}

const INCLUDE = { casa: true, moneda: true, tarjeta: true }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mes = searchParams.get('mes')
  const anio = searchParams.get('anio')
  const casa_id = searchParams.get('casa_id')
  const tipo_pago = searchParams.get('tipo_pago')

  const where: any = {}
  if (mes) where.mes = Number(mes)
  if (anio) where.anio = Number(anio)
  if (casa_id) where.casaId = Number(casa_id)
  if (tipo_pago) where.tipoPago = tipo_pago

  const gastos = await prisma.gasto.findMany({ where, include: INCLUDE, orderBy: { fechaVencimiento: 'asc' } })
  return NextResponse.json(gastos.map(toGastoResponse))
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const gasto = await prisma.gasto.create({
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

  return NextResponse.json(toGastoResponse(gasto), { status: 201 })
}
