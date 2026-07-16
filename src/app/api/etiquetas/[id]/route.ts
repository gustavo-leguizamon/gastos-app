import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { nombre } = await req.json()
  const etiqueta = await prisma.etiqueta.update({ where: { id: Number(params.id) }, data: { nombre } })
  return NextResponse.json(etiqueta)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.etiqueta.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
