import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// El handler no recibe `req` ni lee headers, así que Next lo prerenderiza en el build: el
// autocompletado de sub-items servía el listado congelado al momento de compilar y un concepto
// creado después no aparecía hasta el próximo deploy. Además rompía el build de preview, donde
// no hay `DATABASE_URL`. Mismo caso que `etiquetas/sugeridas`.
export const dynamic = 'force-dynamic'

// Devuelve los nombres de Concepto (fuente de verdad de las descripciones) para el
// autocompletado en GastoForm y GastoItemDialog. El parámetro `parent` ya no se aplica.
export async function GET() {
  const conceptos = await prisma.concepto.findMany({ select: { nombre: true } })
  return NextResponse.json(
    conceptos.map(c => c.nombre).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })),
  )
}
