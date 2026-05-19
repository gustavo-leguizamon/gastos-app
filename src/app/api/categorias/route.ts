import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const categorias = await prisma.categoria.findMany({ orderBy: { nombre: 'asc' } })
  return NextResponse.json(categorias)
}

export async function POST(req: NextRequest) {
  const { nombre } = await req.json()
  const categoria = await prisma.categoria.create({ data: { nombre } })
  return NextResponse.json(categoria, { status: 201 })
}
