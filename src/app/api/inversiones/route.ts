import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { toInversionResponse, parseMonedaId } from '@/lib/inversiones-compute'

const INCLUDE = { moneda: true }

export async function GET() {
  const inversiones = await prisma.inversion.findMany({ orderBy: { id: 'asc' }, include: INCLUDE })
  return NextResponse.json(inversiones.map(toInversionResponse))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const nombre = String(body?.nombre ?? '').trim()
  if (!nombre) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

  const inversion = await prisma.inversion.create({
    data: { nombre, monedaId: parseMonedaId(body?.moneda_id) },
    include: INCLUDE,
  })
  return NextResponse.json(toInversionResponse(inversion), { status: 201 })
}
