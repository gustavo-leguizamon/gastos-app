import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { nombre } = await req.json()
  const lugar = await prisma.lugar.update({ where: { id: Number(params.id) }, data: { nombre } })
  return NextResponse.json(lugar)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.lugar.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
