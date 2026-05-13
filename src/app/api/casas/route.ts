import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const casas = await prisma.casa.findMany({ orderBy: { nombre: 'asc' } })
  return NextResponse.json(casas)
}

export async function POST(req: NextRequest) {
  const { nombre } = await req.json()
  const casa = await prisma.casa.create({ data: { nombre } })
  return NextResponse.json(casa, { status: 201 })
}
