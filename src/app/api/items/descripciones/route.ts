import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const parent = searchParams.get('parent')?.trim()

  // Si viene `parent`, restringimos a los items cuyo gasto padre tenga esa descripción (case-insensitive)
  const where = parent
    ? { gasto: { descripcion: { equals: parent, mode: 'insensitive' as const } } }
    : undefined

  const items = await prisma.gastoItem.findMany({
    where,
    select: { descripcion: true },
    distinct: ['descripcion'],
    orderBy: { descripcion: 'asc' },
  })
  return NextResponse.json(items.map(i => i.descripcion))
}
