import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const tarjetas = await prisma.tarjeta.findMany({ orderBy: { nombre: 'asc' } })
  return NextResponse.json(tarjetas)
}

export async function POST(req: NextRequest) {
  const { nombre, banco } = await req.json()
  const tarjeta = await prisma.tarjeta.create({ data: { nombre, banco: banco || null } })
  return NextResponse.json(tarjeta, { status: 201 })
}
