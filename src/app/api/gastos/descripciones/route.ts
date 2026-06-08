import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Devuelve los nombres de Concepto (fuente de verdad de las descripciones) para el
// autocompletado en GastoForm y GastoItemDialog. Antes era un `distinct` sobre texto libre.
export async function GET() {
  const conceptos = await prisma.concepto.findMany({ select: { nombre: true } })
  return NextResponse.json(
    conceptos.map(c => c.nombre).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })),
  )
}
