import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { toGastoResponse } from '@/lib/gastos-compute'

const INCLUDE = {
  casa: true,
  moneda: true,
  tarjeta: { include: { cierres: true } },
  categoria: true,
  pagos: { orderBy: { createdAt: 'asc' as const } },
  items: { orderBy: { createdAt: 'asc' as const }, include: { categoria: true } },
}

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

  const gastos = await prisma.gasto.findMany({ where, include: INCLUDE, orderBy: [{ fechaVencimiento: 'asc' }, { id: 'asc' }] })
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
      cuotaActual: body.cuota_actual ?? null,
      cuotasTotales: body.cuotas_totales ?? null,
      mes: body.mes,
      anio: body.anio,
      notas: body.notas || null,
      confirmado: body.confirmado ?? true,
      categoriaId: body.categoria_id ?? null,
      esTarjeta: body.es_tarjeta ?? false,
    },
    include: INCLUDE,
  })

  return NextResponse.json(toGastoResponse(gasto), { status: 201 })
}
