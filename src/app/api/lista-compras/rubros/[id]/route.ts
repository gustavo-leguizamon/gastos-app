import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseNombreCatalogo } from '@/lib/lista-compras-compute'
import { borrarCatalogo, renombrarCatalogo } from '@/lib/lista-compras-catalogo'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
  const nombre = parseNombreCatalogo(await req.json())
  if (!nombre) return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 })

  const { status, body } = await renombrarCatalogo(prisma.rubro, id, nombre)
  return NextResponse.json(body, { status })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const { status, body } = await borrarCatalogo(prisma.rubro, id)
  return NextResponse.json(body, { status })
}
