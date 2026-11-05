import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { errorMultiplo, esUnidadMultiplo, inferirSubunidad, parseNombreCatalogo } from '@/lib/lista-compras-compute'
import { resolveCatalogo } from '@/lib/lista-compras-db'

// Sin `req` Next lo prerenderiza en el build y congela el catálogo (ver prerender-guard.test.ts).
export const dynamic = 'force-dynamic'

/** Unidades disponibles para elegir, por nombre, con su equivalencia (g → kg, ml → l) y su uso. */
export async function GET() {
  const unidades = await prisma.unidad.findMany({
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { articulos: true } } },
  })
  return NextResponse.json(
    unidades.map((u) => ({ id: u.id, nombre: u.nombre, subunidad_de: u.subunidadDe ?? null, uso: u._count.articulos })),
  )
}

/**
 * Agrega una unidad nueva. Si ya existe una con ese nombre (sin distinguir mayúsculas)
 * devuelve la existente con 200 en vez de duplicarla ni fallar. Al crear, la equivalencia se
 * infiere del nombre ("g", "gramos" → kg; "ml", "cc" → l); el resto queda sin equivalencia.
 */
export async function POST(req: NextRequest) {
  const nombre = parseNombreCatalogo(await req.json())
  if (!nombre) return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 })
  const multiplo = esUnidadMultiplo(nombre)
  if (multiplo) return NextResponse.json({ error: errorMultiplo(multiplo) }, { status: 400 })
  const subunidadDe = inferirSubunidad(nombre)
  const { fila, creada } = await resolveCatalogo(prisma.unidad, nombre, subunidadDe ? { subunidadDe } : {})
  return NextResponse.json(
    { id: fila.id, nombre: fila.nombre, subunidad_de: (fila as any).subunidadDe ?? null },
    { status: creada ? 201 : 200 },
  )
}
