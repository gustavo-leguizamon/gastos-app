import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { antesDe } from '@/lib/lista-compras-db'
import { parseCopiarBody } from '@/lib/lista-compras-compute'

/**
 * Arma la lista de un mes con los artículos y cantidades del último mes anterior que tenga
 * lista. Los precios NO se copian (quedan en null: son lo que se va a comprar, y el de la
 * compra anterior aparece como referencia) y nada arranca comprado (cantidad llevada en 0). No pisa lo
 * que ya esté cargado en el mes destino.
 */
export async function POST(req: NextRequest) {
  const destino = parseCopiarBody(await req.json())
  if (!destino) return NextResponse.json({ error: 'Período inválido' }, { status: 400 })

  const ultima = await prisma.listaCompraItem.findFirst({
    where: antesDe(destino.mes, destino.anio),
    orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    select: { mes: true, anio: true },
  })
  if (!ultima) return NextResponse.json({ error: 'No hay una lista anterior para copiar' }, { status: 404 })

  const origen = await prisma.listaCompraItem.findMany({
    where: { mes: ultima.mes, anio: ultima.anio },
    select: { articuloId: true, cantidad: true },
  })
  const presentes = await prisma.listaCompraItem.findMany({
    where: { mes: destino.mes, anio: destino.anio },
    select: { articuloId: true },
  })
  const ocupados = new Set(presentes.map((p) => p.articuloId))
  const nuevos = origen.filter((o) => !ocupados.has(o.articuloId))

  if (nuevos.length) {
    await prisma.listaCompraItem.createMany({
      data: nuevos.map((o) => ({ articuloId: o.articuloId, mes: destino.mes, anio: destino.anio, cantidad: o.cantidad })),
    })
  }
  return NextResponse.json({
    copiados: nuevos.length,
    omitidos: origen.length - nuevos.length,
    origen: ultima,
  })
}
