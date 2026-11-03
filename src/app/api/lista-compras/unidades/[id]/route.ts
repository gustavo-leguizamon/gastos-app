import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseUnidadPatch } from '@/lib/lista-compras-compute'
import { actualizarUnidad, borrarCatalogo } from '@/lib/lista-compras-catalogo'

/** Edita el nombre y/o la equivalencia (`subunidad_de`: `"kg"`, `"l"` o `null`) de una unidad. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
  const patch = parseUnidadPatch(await req.json())
  if (!patch) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const { status, body } = await actualizarUnidad(prisma.unidad, id, patch)
  return NextResponse.json(body, { status })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const { status, body } = await borrarCatalogo(prisma.unidad, id)
  return NextResponse.json(body, { status })
}
