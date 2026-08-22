import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Igual que `items/descripciones`: sin `req` Next lo prerenderiza en el build, devolviendo
// para siempre los conceptos que existían al compilar y rompiendo el build donde no hay
// `DATABASE_URL` (preview). Hoy ningún componente la consume — `GastoForm` usa
// `/api/conceptos` — pero mientras la ruta exista tiene que devolver datos vivos.
export const dynamic = 'force-dynamic'

// Devuelve los nombres de Concepto (fuente de verdad de las descripciones) para el
// autocompletado en GastoForm y GastoItemDialog. Antes era un `distinct` sobre texto libre.
export async function GET() {
  const conceptos = await prisma.concepto.findMany({ select: { nombre: true } })
  return NextResponse.json(
    conceptos.map(c => c.nombre).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })),
  )
}
