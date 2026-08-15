import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseIngresoBody, toIngresoResponse } from '@/lib/ingresos-compute'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const body = await req.json()
  const data = parseIngresoBody(body)
  if (!data) return NextResponse.json({ error: 'Datos de ingreso inválidos' }, { status: 400 })

  const existente = await prisma.ingreso.findUnique({ where: { id } })
  if (!existente) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const ingreso = await prisma.ingreso.update({ where: { id }, data, include: { casa: true, moneda: true } })
  return NextResponse.json(toIngresoResponse(ingreso))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const existente = await prisma.ingreso.findUnique({ where: { id } })
  if (!existente) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await prisma.ingreso.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
