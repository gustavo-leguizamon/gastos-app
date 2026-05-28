import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isSueldosAllowed } from '@/lib/sueldos-auth'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isSueldosAllowed())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const s = await prisma.sueldo.update({
    where: { id: Number(params.id) },
    data: {
      fecha: body.fecha,
      sueldoTeorico: Number(body.sueldo_teorico ?? 0),
      sueldoArs: Number(body.sueldo_ars ?? 0),
      sueldoUsd: Number(body.sueldo_usd ?? 0),
      cotizacionBna: Number(body.cotizacion_bna ?? 0),
      cotizacionMep: Number(body.cotizacion_mep ?? 0),
    },
  })
  return NextResponse.json({
    id: s.id,
    fecha: s.fecha,
    sueldo_teorico: s.sueldoTeorico,
    sueldo_ars: s.sueldoArs,
    sueldo_usd: s.sueldoUsd,
    cotizacion_bna: s.cotizacionBna,
    cotizacion_mep: s.cotizacionMep,
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isSueldosAllowed())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await prisma.sueldo.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
