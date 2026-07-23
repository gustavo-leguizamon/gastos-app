import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { nombre } = await req.json()
  const etiqueta = await prisma.etiqueta.update({ where: { id: Number(params.id) }, data: { nombre } })
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
