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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const cierres = await prisma.tarjetaCierre.findMany({
    where: { tarjetaId: Number(params.id) },
    orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
  })
  return NextResponse.json(cierres.map(toResponse))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const cierre = await prisma.tarjetaCierre.create({
      data: {
        tarjetaId: Number(params.id),
        mes: Number(body.mes),
        anio: Number(body.anio),
        fechaCierre: body.fecha_cierre || null,
        fechaVencimiento: body.fecha_vencimiento || null,
        fechaProximoCierre: body.fecha_proximo_cierre || null,
      },
    })
    return NextResponse.json(toResponse(cierre), { status: 201 })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Unique: ya existe un cierre para ese mes/año' }, { status: 409 })
    }
    console.error('POST /api/tarjetas/[id]/cierres failed:', err)
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 })
  }
}
