import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  await prisma.gastoItem.delete({ where: { id: Number(params.itemId) } })
  return NextResponse.json({ ok: true })
}
