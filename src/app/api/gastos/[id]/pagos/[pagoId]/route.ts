import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; pagoId: string } }) {
  await prisma.pago.delete({ where: { id: Number(params.pagoId) } })
  return NextResponse.json({ ok: true })
}
