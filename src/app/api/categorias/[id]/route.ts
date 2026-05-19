import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { nombre } = await req.json()
  const categoria = await prisma.categoria.update({ where: { id: Number(params.id) }, data: { nombre } })
  return NextResponse.json(categoria)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.categoria.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
