import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseOperacionBody, toOperacionResponse } from '@/lib/divisas-compute'

const INCLUDE = { moneda: true }

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const body = await req.json()
  const data = parseOperacionBody(body)
  if (!data) return NextResponse.json({ error: 'Datos de la operación inválidos' }, { status: 400 })

  const existente = await prisma.operacionDivisa.findUnique({ where: { id } })
  if (!existente) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const operacion = await prisma.operacionDivisa.update({ where: { id }, data, include: INCLUDE })
  return NextResponse.json(toOperacionResponse(operacion))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const existente = await prisma.operacionDivisa.findUnique({ where: { id } })
  if (!existente) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  await prisma.operacionDivisa.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
