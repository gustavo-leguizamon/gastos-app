import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cargarItemResponse, recalcularLinea } from '@/lib/lista-compras-db'
import { parseCompraBody } from '@/lib/lista-compras-compute'

function ids(params: { id: string; compraId: string }) {
  const id = Number(params.id)
  const compraId = Number(params.compraId)
  return Number.isInteger(id) && id > 0 && Number.isInteger(compraId) && compraId > 0 ? { id, compraId } : null
}

/** Edita una compra y recalcula la línea. 404 si la compra no es de esa línea. */
export async function PUT(req: NextRequest, { params }: { params: { id: string; compraId: string } }) {
  const parsed = ids(params)
  if (!parsed) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
  const data = parseCompraBody(await req.json())
  if (!data) return NextResponse.json({ error: 'Datos de la compra inválidos' }, { status: 400 })

  const compra = await prisma.listaCompraCompra.findFirst({ where: { id: parsed.compraId, itemId: parsed.id } })
  if (!compra) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await prisma.listaCompraCompra.update({ where: { id: parsed.compraId }, data })
  await recalcularLinea(prisma, parsed.id)
  return NextResponse.json(await cargarItemResponse(prisma, parsed.id))
}

/**
 * Borra una compra y recalcula la línea. Al borrar la última, lo llevado vuelve a 0 y el precio
 * **se conserva** (`recalcularLinea` no toca el precio si no queda ninguna con precio).
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; compraId: string } }) {
  const parsed = ids(params)
  if (!parsed) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const compra = await prisma.listaCompraCompra.findFirst({ where: { id: parsed.compraId, itemId: parsed.id } })
  if (!compra) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await prisma.listaCompraCompra.delete({ where: { id: parsed.compraId } })
  await recalcularLinea(prisma, parsed.id)
  return NextResponse.json(await cargarItemResponse(prisma, parsed.id))
}
