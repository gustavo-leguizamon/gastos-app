import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { antesDe, INCLUDE_ITEM, resolveArticulo } from '@/lib/lista-compras-db'
import { parseItemBody, referenciaDe, toItemResponse, totalesLista } from '@/lib/lista-compras-compute'

/** Lista del mes con, por línea, el último precio al que se compró el artículo antes de este mes. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mes = Number(searchParams.get('mes'))
  const anio = Number(searchParams.get('anio'))
  if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio)) {
    return NextResponse.json({ error: 'Período inválido' }, { status: 400 })
  }

  const filas = await prisma.listaCompraItem.findMany({
    where: { mes, anio },
    include: INCLUDE_ITEM,
    orderBy: { articulo: { nombre: 'asc' } },
  })

  // Una sola query para todo el histórico de los artículos de la lista.
  const historico = filas.length
    ? await prisma.listaCompraItem.findMany({
        where: { articuloId: { in: filas.map((f) => f.articuloId) }, precioUnitario: { not: null }, ...antesDe(mes, anio) },
        select: { articuloId: true, cantidad: true, precioUnitario: true, mes: true, anio: true },
      })
    : []

  const items = filas.map((f) =>
    toItemResponse(f, referenciaDe(historico.filter((h) => h.articuloId === f.articuloId), { mes, anio })),
  )
  return NextResponse.json({ mes, anio, items, totales: totalesLista(items) })
}

export async function POST(req: NextRequest) {
  const data = parseItemBody(await req.json())
  if (!data) return NextResponse.json({ error: 'Datos del artículo inválidos' }, { status: 400 })

  // Unidad y rubro se eligen de los existentes (o se agregan antes por /unidades y /rubros).
  if (!(await prisma.unidad.findUnique({ where: { id: data.unidadId } }))) {
    return NextResponse.json({ error: 'La unidad no existe' }, { status: 400 })
  }
  if (data.rubroId != null && !(await prisma.rubro.findUnique({ where: { id: data.rubroId } }))) {
    return NextResponse.json({ error: 'El rubro no existe' }, { status: 400 })
  }

  const articuloId = await resolveArticulo(prisma, data)
  const yaEsta = await prisma.listaCompraItem.findUnique({
    where: { articuloId_mes_anio: { articuloId, mes: data.mes, anio: data.anio } },
  })
  if (yaEsta) return NextResponse.json({ error: 'El artículo ya está en la lista de este mes' }, { status: 409 })

  const fila = await prisma.listaCompraItem.create({
    data: {
      articuloId,
      mes: data.mes,
      anio: data.anio,
      cantidad: data.cantidad,
      precioUnitario: data.precioUnitario,
    },
    include: INCLUDE_ITEM,
  })
  return NextResponse.json(toItemResponse(fila, null), { status: 201 })
}
