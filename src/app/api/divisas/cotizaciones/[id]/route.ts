import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const existente = await prisma.cotizacionDivisa.findUnique({ where: { id } })
  if (!existente) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  await prisma.cotizacionDivisa.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
