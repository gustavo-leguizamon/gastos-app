import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cargarItemResponse, recalcularLinea } from '@/lib/lista-compras-db'
import { parseCompraBody } from '@/lib/lista-compras-compute'

/**
 * Registra una compra de la línea (cantidad, precio opcional, fecha) y recalcula lo llevado y el
 * precio promedio. Devuelve la línea ya actualizada.
 *
 * Si la línea todavía no tenía compras pero sí una cantidad llevada cargada a mano, esa cantidad
 * (con el precio que tenía la línea) se convierte primero en una compra inicial: si no, la primera
 * compra registrada pisaría lo que ya se llevaba.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const data = parseCompraBody(await req.json())
  if (!data) return NextResponse.json({ error: 'Datos de la compra inválidos' }, { status: 400 })

  const linea = await prisma.listaCompraItem.findUnique({ where: { id } })
  if (!linea) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (linea.cantidadComprada > 0 && (await prisma.listaCompraCompra.count({ where: { itemId: id } })) === 0) {
    await prisma.listaCompraCompra.create({
      data: { itemId: id, cantidad: linea.cantidadComprada, precioUnitario: linea.precioUnitario, fecha: data.fecha },
    })
  }
  await prisma.listaCompraCompra.create({ data: { itemId: id, ...data } })
  await recalcularLinea(prisma, id)

  return NextResponse.json(await cargarItemResponse(prisma, id), { status: 201 })
}
