import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parsePlataformaBody, toPlataformaResponse } from '@/lib/divisas-plataformas'

/** Plataformas de una divisa (todas: la página filtra las activas para comparar). */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const monedaId = searchParams.get('moneda_id')

  const rows = await prisma.plataformaDivisa.findMany({
    where: monedaId ? { monedaId: Number(monedaId) } : {},
    orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
  })
  return NextResponse.json(rows.map(toPlataformaResponse))
}

export async function POST(req: NextRequest) {
  const data = parsePlataformaBody(await req.json())
  if (!data) return NextResponse.json({ error: 'Datos de la plataforma inválidos' }, { status: 400 })

  const row = await prisma.plataformaDivisa.create({ data })
  return NextResponse.json(toPlataformaResponse(row), { status: 201 })
}
