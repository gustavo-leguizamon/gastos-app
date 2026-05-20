import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const gastos = await prisma.gasto.findMany({
    select: { descripcion: true },
    distinct: ['descripcion'],
    orderBy: { descripcion: 'asc' },
  })
  return NextResponse.json(gastos.map(g => g.descripcion))
}
