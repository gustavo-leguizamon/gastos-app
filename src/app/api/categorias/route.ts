import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/categorias — lista de categorías con su conteo de uso (gastos + sub-items).
export async function GET() {
  const categorias = await prisma.categoria.findMany({
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { gastos: true, items: true } } },
  })
  const data = categorias.map(c => ({ id: c.id, nombre: c.nombre, uso: c._count.gastos + c._count.items }))
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { nombre } = await req.json()
  const categoria = await prisma.categoria.create({ data: { nombre } })
  return NextResponse.json(categoria, { status: 201 })
}
