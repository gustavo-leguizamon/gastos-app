import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Sin `req` Next lo prerenderiza en el build y congela el catálogo (ver prerender-guard.test.ts).
export const dynamic = 'force-dynamic'

/** Catálogo para autocompletar el alta, con el último precio al que se compró cada uno. */
export async function GET() {
  const articulos = await prisma.articulo.findMany({
    orderBy: { nombre: 'asc' },
    include: {
      unidad: true,
      rubro: true,
      items: {
        where: { precioUnitario: { not: null } },
        orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
        take: 1,
        select: { precioUnitario: true },
      },
    },
  })
  return NextResponse.json(
    articulos.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      unidad_id: a.unidadId,
      unidad: a.unidad.nombre,
      rubro_id: a.rubroId,
      rubro: a.rubro?.nombre ?? null,
      ultimo_precio: a.items[0]?.precioUnitario ?? null,
    })),
  )
}
