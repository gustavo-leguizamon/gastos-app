import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { codigo, nombre, simbolo } = await req.json()
  const moneda = await prisma.moneda.update({ where: { id: Number(params.id) }, data: { codigo: codigo.toUpperCase(), nombre, simbolo } })
  return NextResponse.json(moneda)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.moneda.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
