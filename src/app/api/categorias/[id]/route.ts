import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { normalizeNombre } from '@/lib/clasificadores'

// PUT /api/categorias/[id] — renombra. Rechaza con 409 si el nombre ya lo usa otra categoría
// (case-insensitive): renombrar encima de una existente crearía el duplicado que la unicidad
// del schema evita, y el camino correcto para juntarlas es el merge.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  const { nombre: raw } = await req.json()
  const nombre = normalizeNombre(raw ?? '')
  if (!nombre) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

  const colision = await prisma.categoria.findFirst({
    where: { nombre: { equals: nombre, mode: 'insensitive' }, id: { not: id } },
  })
  if (colision) {
    return NextResponse.json(
      { error: `Ya existe la categoría "${colision.nombre}". Fusionalas en vez de renombrar.` },
      { status: 409 },
    )
  }

  const categoria = await prisma.categoria.update({ where: { id }, data: { nombre } })
  return NextResponse.json(categoria)
}

// DELETE /api/categorias/[id] — borra una categoría sólo si no está en uso.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  const categoria = await prisma.categoria.findUnique({
    where: { id },
    include: { _count: { select: { gastos: true, items: true } } },
  })
  if (!categoria) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const uso = categoria._count.gastos + categoria._count.items
  if (uso > 0) {
    return NextResponse.json(
      { error: `No se puede borrar: está en uso por ${uso} gasto(s)/sub-item(s).` },
      { status: 409 },
    )
  }

  await prisma.categoria.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
