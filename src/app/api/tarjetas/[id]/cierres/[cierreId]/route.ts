import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function toResponse(c: any) {
  return {
    id: c.id,
    tarjeta_id: c.tarjetaId,
    mes: c.mes,
    anio: c.anio,
    fecha_cierre: c.fechaCierre ?? null,
    fecha_vencimiento: c.fechaVencimiento ?? null,
    fecha_proximo_cierre: c.fechaProximoCierre ?? null,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string; cierreId: string } }) {
  const body = await req.json()
  const cierre = await prisma.tarjetaCierre.update({
    where: { id: Number(params.cierreId) },
    data: {
      mes: body.mes !== undefined ? Number(body.mes) : undefined,
      anio: body.anio !== undefined ? Number(body.anio) : undefined,
      fechaCierre: body.fecha_cierre ?? null,
      fechaVencimiento: body.fecha_vencimiento ?? null,
      fechaProximoCierre: body.fecha_proximo_cierre ?? null,
    },
  })
  return NextResponse.json(toResponse(cierre))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; cierreId: string } }) {
  await prisma.tarjetaCierre.delete({ where: { id: Number(params.cierreId) } })
  return NextResponse.json({ ok: true })
}
