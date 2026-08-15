import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { buildIngresosWhere, parseIngresoBody, toIngresoResponse } from '@/lib/ingresos-compute'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const where = buildIngresosWhere(
    searchParams.get('mes'),
    searchParams.get('anio'),
    searchParams.get('casa_id'),
  )

  const ingresos = await prisma.ingreso.findMany({
    where,
    include: { casa: true, moneda: true },
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
  })
  return NextResponse.json(ingresos.map(toIngresoResponse))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const data = parseIngresoBody(body)
  if (!data) return NextResponse.json({ error: 'Datos de ingreso inválidos' }, { status: 400 })

  const ingreso = await prisma.ingreso.create({ data, include: { casa: true, moneda: true } })
  return NextResponse.json(toIngresoResponse(ingreso), { status: 201 })
}
