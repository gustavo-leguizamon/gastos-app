import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Etiquetas: corte transversal (M2M) de gastos/ítems. CRUD espejo de /api/categorias.
export async function GET() {
  const etiquetas = await prisma.etiqueta.findMany({ orderBy: { nombre: 'asc' } })
  return NextResponse.json(etiquetas)
}

export async function POST(req: NextRequest) {
  const { nombre } = await req.json()
  const etiqueta = await prisma.etiqueta.create({ data: { nombre } })
  return NextResponse.json(etiqueta, { status: 201 })
}
