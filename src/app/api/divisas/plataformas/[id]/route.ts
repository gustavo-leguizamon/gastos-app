import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parsePlataformaBody, toPlataformaResponse } from '@/lib/divisas-plataformas'

function parseId(raw: string): number | null {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id)
  if (id === null) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const data = parsePlataformaBody(await req.json())
  if (!data) return NextResponse.json({ error: 'Datos de la plataforma inválidos' }, { status: 400 })

  const existente = await prisma.plataformaDivisa.findUnique({ where: { id } })
  if (!existente) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const row = await prisma.plataformaDivisa.update({ where: { id }, data })
  return NextResponse.json(toPlataformaResponse(row))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id)
  if (id === null) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const existente = await prisma.plataformaDivisa.findUnique({ where: { id } })
  if (!existente) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  await prisma.plataformaDivisa.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
