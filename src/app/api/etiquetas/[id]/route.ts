import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { normalizeNombre } from '@/lib/clasificadores'

// PUT /api/etiquetas/[id] — renombra. 409 ante colisión, espejo de /api/categorias/[id].
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  const { nombre: raw } = await req.json()
  const nombre = normalizeNombre(raw ?? '')
  if (!nombre) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

  const colision = await prisma.etiqueta.findFirst({
    where: { nombre: { equals: nombre, mode: 'insensitive' }, id: { not: id } },
  })
  if (colision) {
    return NextResponse.json(
      { error: `Ya existe la etiqueta "${colision.nombre}". Fusionalas en vez de renombrar.` },
      { status: 409 },
    )
  }

  const etiqueta = await prisma.etiqueta.update({ where: { id }, data: { nombre } })
  return NextResponse.json(etiqueta)
}

// DELETE /api/etiquetas/[id] — borra una etiqueta sólo si no está en uso.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  const etiqueta = await prisma.etiqueta.findUnique({
    where: { id },
    include: { _count: { select: { gastos: true, items: true } } },
  })
  if (!etiqueta) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const uso = etiqueta._count.gastos + etiqueta._count.items
  if (uso > 0) {
    return NextResponse.json(
      { error: `No se puede borrar: está en uso por ${uso} gasto(s)/sub-item(s).` },
      { status: 409 },
    )
  }

  await prisma.etiqueta.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
