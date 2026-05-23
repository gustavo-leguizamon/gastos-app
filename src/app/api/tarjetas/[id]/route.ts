import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { nombre, banco, marca } = await req.json()
  const tarjeta = await prisma.tarjeta.update({
    where: { id: Number(params.id) },
    data: { nombre, banco: banco || null, marca: marca || null },
  })
  return NextResponse.json(tarjeta)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.tarjeta.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
