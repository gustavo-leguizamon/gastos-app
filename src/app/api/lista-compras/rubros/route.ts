import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseNombreCatalogo } from '@/lib/lista-compras-compute'
import { resolveCatalogo } from '@/lib/lista-compras-db'

// Sin `req` Next lo prerenderiza en el build y congela el catálogo (ver prerender-guard.test.ts).
export const dynamic = 'force-dynamic'

/** Rubros disponibles para elegir, por nombre. */
export async function GET() {
  const rubros = await prisma.rubro.findMany({
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { articulos: true } } },
  })
  return NextResponse.json(rubros.map((u) => ({ id: u.id, nombre: u.nombre, uso: u._count.articulos })))
}

/**
 * Agrega un rubro nuevo. Si ya existe uno con ese nombre (sin distinguir mayúsculas)
 * devuelve la existente con 200 en vez de duplicarla ni fallar.
 */
export async function POST(req: NextRequest) {
  const nombre = parseNombreCatalogo(await req.json())
  if (!nombre) return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 })
  const { fila, creada } = await resolveCatalogo(prisma.rubro, nombre)
  return NextResponse.json({ id: fila.id, nombre: fila.nombre }, { status: creada ? 201 : 200 })
}
