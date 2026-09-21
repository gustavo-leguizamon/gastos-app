import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseOperacionBody, toOperacionResponse } from '@/lib/divisas-compute'

const INCLUDE = { moneda: true }

/**
 * Las operaciones de una divisa, **en orden cronológico ascendente**: es el orden que espera
 * `computeOperaciones` para la corrida (cada fila se apoya en el estado de la anterior). La
 * página invierte el array si quiere mostrarlas de la más nueva a la más vieja.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const monedaId = searchParams.get('moneda_id')

  const where = monedaId ? { monedaId: Number(monedaId) } : {}
  const operaciones = await prisma.operacionDivisa.findMany({
    where,
    include: INCLUDE,
    orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
  })
  return NextResponse.json(operaciones.map(toOperacionResponse))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const data = parseOperacionBody(body)
  if (!data) return NextResponse.json({ error: 'Datos de la operación inválidos' }, { status: 400 })

  const operacion = await prisma.operacionDivisa.create({ data, include: INCLUDE })
  return NextResponse.json(toOperacionResponse(operacion), { status: 201 })
}
