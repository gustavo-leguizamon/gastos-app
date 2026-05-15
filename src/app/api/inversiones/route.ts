import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function toResponse(i: { id: number; nombre: string; createdAt: Date }) {
  return { id: i.id, nombre: i.nombre, created_at: i.createdAt.toISOString() }
}

export async function GET() {
  const inversiones = await prisma.inversion.findMany({ orderBy: { id: 'asc' } })
  return NextResponse.json(inversiones.map(toResponse))
}

export async function POST(req: NextRequest) {
  const { nombre } = await req.json()
  const inversion = await prisma.inversion.create({ data: { nombre } })
  return NextResponse.json(toResponse(inversion), { status: 201 })
}
