import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { nombre } = await req.json()
  const inversion = await prisma.inversion.update({
    where: { id: Number(params.id) },
    data: { nombre },
  })
  return NextResponse.json({
    id: inversion.id,
    nombre: inversion.nombre,
    created_at: inversion.createdAt.toISOString(),
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.inversion.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
