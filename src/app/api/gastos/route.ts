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
    categoria_id: g.categoriaId ?? null,
    categoria_nombre: g.categoria?.nombre ?? null,
    cuota_actual: g.cuotaActual ?? null,
    cuotas_totales: g.cuotasTotales ?? null,
    mes: g.mes,
    anio: g.anio,
    notas: g.notas,
    confirmado: g.confirmado,
    es_tarjeta: g.esTarjeta ?? false,
    fecha_cierre: g.fechaCierre ?? null,
    fecha_proximo_cierre: g.fechaProximoCierre ?? null,
    created_at: g.createdAt?.toISOString(),
    updated_at: g.updatedAt?.toISOString(),
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
      categoria_id: i.categoriaId ?? null,
      categoria_nombre: i.categoria?.nombre ?? null,
      created_at: i.createdAt?.toISOString(),
    })),
  }
}

const INCLUDE = {
  casa: true,
  moneda: true,
  tarjeta: true,
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
      cuotaActual: body.cuota_actual ?? null,
      cuotasTotales: body.cuotas_totales ?? null,
      mes: body.mes,
      anio: body.anio,
      notas: body.notas || null,
      confirmado: body.confirmado ?? true,
      categoriaId: body.categoria_id ?? null,
      esTarjeta: body.es_tarjeta ?? false,
      fechaCierre: body.fecha_cierre || null,
      fechaProximoCierre: body.fecha_proximo_cierre || null,
    },
    include: INCLUDE,
  })

  return NextResponse.json(toGastoResponse(gasto), { status: 201 })
}
