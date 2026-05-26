import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const tarjetas = await prisma.tarjeta.findMany({
    orderBy: { nombre: 'asc' },
    include: { cierres: true },
  })
  return NextResponse.json(tarjetas.map(t => ({
    id: t.id,
    nombre: t.nombre,
    banco: t.banco,
    marca: t.marca,
    cierres: t.cierres.map(c => ({
      id: c.id,
      tarjeta_id: c.tarjetaId,
      mes: c.mes,
      anio: c.anio,
      fecha_cierre: c.fechaCierre ?? null,
      fecha_vencimiento: c.fechaVencimiento ?? null,
      fecha_proximo_cierre: c.fechaProximoCierre ?? null,
      created_at: c.createdAt.toISOString(),
      updated_at: c.updatedAt.toISOString(),
    })),
  })))
}

export async function POST(req: NextRequest) {
  const { nombre, banco, marca } = await req.json()
  const tarjeta = await prisma.tarjeta.create({ data: { nombre, banco: banco || null, marca: marca || null } })
  return NextResponse.json(tarjeta, { status: 201 })
}
