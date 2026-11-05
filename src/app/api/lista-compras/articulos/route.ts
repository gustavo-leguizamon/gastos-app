import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ultimosDeArticulo } from '@/lib/lista-compras-compute'

// Sin `req` Next lo prerenderiza en el build y congela el catálogo (ver prerender-guard.test.ts).
export const dynamic = 'force-dynamic'

/** Catálogo para autocompletar el alta, con el último precio y la última cantidad de cada uno. */
export async function GET() {
  const articulos = await prisma.articulo.findMany({
    orderBy: { nombre: 'asc' },
    include: {
      unidad: true,
      rubro: true,
      items: {
        orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
        select: { cantidad: true, precioUnitario: true },
      },
    },
  })
  return NextResponse.json(
    articulos.map((a) => {
      const ultimos = ultimosDeArticulo(a.items)
      return {
      id: a.id,
      nombre: a.nombre,
      unidad_id: a.unidadId,
      unidad: a.unidad.nombre,
      rubro_id: a.rubroId,
      rubro: a.rubro?.nombre ?? null,
      mostrar_en_multiplo: a.mostrarEnMultiplo,
      ultimo_precio: ultimos.precio,
      ultima_cantidad: ultimos.cantidad,
    }}),
  )
}
