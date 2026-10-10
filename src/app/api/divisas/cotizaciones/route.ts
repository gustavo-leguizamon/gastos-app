import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseCotizacionBody, toCotizacionResponse } from '@/lib/divisas-compute'

/** Histórico de cotizaciones de una divisa, cronológico ascendente (el orden de la serie). */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const monedaId = searchParams.get('moneda_id')

  const cotizaciones = await prisma.cotizacionDivisa.findMany({
    where: monedaId ? { monedaId: Number(monedaId) } : {},
    orderBy: [{ fecha: 'asc' }],
  })
  return NextResponse.json(cotizaciones.map(toCotizacionResponse))
}

/**
 * Upsert sobre `(monedaId, fecha)`: hay **una** cotización de referencia por día y divisa, y
 * recargar el mismo día corrige el valor en vez de dejar dos versiones compitiendo por ser
 * la que valúa la tenencia.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const data = parseCotizacionBody(body)
  if (!data) return NextResponse.json({ error: 'Datos de la cotización inválidos' }, { status: 400 })

  const { monedaId, fecha, valor, fuente } = data
  const cotizacion = await prisma.cotizacionDivisa.upsert({
    where: { monedaId_fecha: { monedaId, fecha } },
    create: data,
    update: { valor, fuente },
  })
  return NextResponse.json(toCotizacionResponse(cotizacion), { status: 201 })
}
