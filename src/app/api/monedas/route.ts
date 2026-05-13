import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const monedas = await prisma.moneda.findMany({ orderBy: { codigo: 'asc' } })
  return NextResponse.json(monedas)
}

export async function POST(req: NextRequest) {
  const { codigo, nombre, simbolo } = await req.json()
  const moneda = await prisma.moneda.create({ data: { codigo: codigo.toUpperCase(), nombre, simbolo } })
  return NextResponse.json(moneda, { status: 201 })
}
