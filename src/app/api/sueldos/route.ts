import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isSueldosAllowed } from '@/lib/sueldos-auth'

function toResponse(s: {
  id: number
  fecha: string
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
  if (!(await isSueldosAllowed())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const sueldos = await prisma.sueldo.findMany({ orderBy: [{ fecha: 'desc' }, { id: 'desc' }] })
  return NextResponse.json(sueldos.map(toResponse))
}

export async function POST(req: NextRequest) {
  if (!(await isSueldosAllowed())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const sueldo = await prisma.sueldo.create({
    data: {
      fecha: body.fecha,
      sueldoTeorico: Number(body.sueldo_teorico ?? 0),
      sueldoArs: Number(body.sueldo_ars ?? 0),
      sueldoUsd: Number(body.sueldo_usd ?? 0),
      cotizacionBna: Number(body.cotizacion_bna ?? 0),
      cotizacionMep: Number(body.cotizacion_mep ?? 0),
    },
  })
  return NextResponse.json(toResponse(sueldo), { status: 201 })
}
