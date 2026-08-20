import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { periodoDe } from '@/lib/sueldos-compute'

function toResponse(s: {
  id: number
  fecha: string
  mes: number
  anio: number
  sueldoTeorico: number
  sueldoArs: number
  sueldoUsd: number
  cotizacionBna: number
  cotizacionMep: number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: s.id,
    fecha: s.fecha,
    mes: s.mes,
    anio: s.anio,
    sueldo_teorico: s.sueldoTeorico,
    sueldo_ars: s.sueldoArs,
    sueldo_usd: s.sueldoUsd,
    cotizacion_bna: s.cotizacionBna,
    cotizacion_mep: s.cotizacionMep,
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  }
}

export async function GET() {
  const sueldos = await prisma.sueldo.findMany({ orderBy: [{ anio: 'desc' }, { mes: 'desc' }, { fecha: 'desc' }, { id: 'desc' }] })
  return NextResponse.json(sueldos.map(toResponse))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const sueldo = await prisma.sueldo.create({
    data: {
      fecha: body.fecha,
      ...periodoDe(body),
      sueldoTeorico: Number(body.sueldo_teorico ?? 0),
      sueldoArs: Number(body.sueldo_ars ?? 0),
      sueldoUsd: Number(body.sueldo_usd ?? 0),
      cotizacionBna: Number(body.cotizacion_bna ?? 0),
      cotizacionMep: Number(body.cotizacion_mep ?? 0),
    },
  })
  return NextResponse.json(toResponse(sueldo), { status: 201 })
}
