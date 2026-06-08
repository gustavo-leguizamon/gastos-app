import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { normalizeNombre } from '@/lib/conceptos'

// PATCH /api/conceptos/[id] — renombra un concepto. Como `descripcion` es derivada de
// `concepto.nombre`, el cambio se refleja automáticamente en todo el histórico de gastos/items.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  const body = await req.json()
  const nombre = normalizeNombre(body.nombre ?? '')
  if (!nombre) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

  // No permitir colisión con otro concepto (case-insensitive)
  const colision = await prisma.concepto.findFirst({
    where: { nombre: { equals: nombre, mode: 'insensitive' }, id: { not: id } },
  })
  if (colision) {
    return NextResponse.json(
      { error: `Ya existe el concepto "${colision.nombre}". Fusionalos en vez de renombrar.` },
      { status: 409 },
    )
  }

  const concepto = await prisma.concepto.update({ where: { id }, data: { nombre } })
  return NextResponse.json(concepto)
}

// DELETE /api/conceptos/[id] — borra un concepto sólo si no está en uso.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  const concepto = await prisma.concepto.findUnique({
    where: { id },
    include: { _count: { select: { gastos: true, items: true } } },
  })
  if (!concepto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const uso = concepto._count.gastos + concepto._count.items
  if (uso > 0) {
    return NextResponse.json(
      { error: `No se puede borrar: está en uso por ${uso} gasto(s)/sub-item(s). Fusionalo con otro concepto.` },
      { status: 409 },
    )
  }

  await prisma.concepto.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
