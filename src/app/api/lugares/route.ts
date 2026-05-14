import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const lugares = await prisma.lugar.findMany({ orderBy: { nombre: 'asc' } })
  return NextResponse.json(lugares)
}

export async function POST(req: NextRequest) {
  const { nombre } = await req.json()
  const lugar = await prisma.lugar.create({ data: { nombre } })
  return NextResponse.json(lugar, { status: 201 })
}
