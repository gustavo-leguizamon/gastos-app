import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { antesDe, INCLUDE_ITEM } from '@/lib/lista-compras-db'
import { parseItemPatch, referenciaDe, resolverPatchComprado, toItemResponse } from '@/lib/lista-compras-compute'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const patch = parseItemPatch(await req.json())
  if (!patch) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const existente = await prisma.listaCompraItem.findUnique({ where: { id } })
  if (!existente) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  // Con compras registradas, lo llevado y el precio salen de ellas: editarlos a mano se pisaría
  // en la próxima compra. Se cambian tocando las compras.
  const tocaCompras = patch.cantidadComprada !== undefined || patch.comprado !== undefined || patch.precioUnitario !== undefined
  if (tocaCompras && (await prisma.listaCompraCompra.count({ where: { itemId: id } })) > 0) {
    return NextResponse.json(
      { error: 'La línea tiene compras registradas: lo llevado y el precio se cambian desde las compras' },
      { status: 409 },
    )
  }

  // Nombre, unidad, rubro y en qué unidad se muestra son del artículo (valen para todos los meses); el resto, de la línea.
  // El atajo `comprado` se convierte en cantidad: lo único que se persiste es lo llevado.
  const { unidadId, rubroId, nombre, mostrarEnMultiplo, ...linea } = resolverPatchComprado(patch, existente.cantidad)
  // El nombre es único sin distinguir mayúsculas: chocar con **otro** artículo es 409 (fusionarlos
  // mezclaría sus históricos de precio). El propio se excluye para poder corregir el casing.
  if (nombre !== undefined) {
    const repetido = await prisma.articulo.findFirst({
      where: { nombre: { equals: nombre, mode: 'insensitive' }, NOT: { id: existente.articuloId } },
    })
    if (repetido) return NextResponse.json({ error: `Ya existe el artículo "${repetido.nombre}"` }, { status: 409 })
  }
  if (unidadId !== undefined && !(await prisma.unidad.findUnique({ where: { id: unidadId } }))) {
    return NextResponse.json({ error: 'La unidad no existe' }, { status: 400 })
  }
  if (rubroId != null && !(await prisma.rubro.findUnique({ where: { id: rubroId } }))) {
    return NextResponse.json({ error: 'El rubro no existe' }, { status: 400 })
  }
  if (unidadId !== undefined || rubroId !== undefined || nombre !== undefined || mostrarEnMultiplo !== undefined) {
    await prisma.articulo.update({
      where: { id: existente.articuloId },
      data: {
        ...(unidadId !== undefined ? { unidadId } : {}),
        ...(rubroId !== undefined ? { rubroId } : {}),
        ...(nombre !== undefined ? { nombre } : {}),
        ...(mostrarEnMultiplo !== undefined ? { mostrarEnMultiplo } : {}),
      },
    })
  }

  const fila = await prisma.listaCompraItem.update({ where: { id }, data: linea, include: INCLUDE_ITEM })
  const historico = await prisma.listaCompraItem.findMany({
    where: { articuloId: fila.articuloId, precioUnitario: { not: null }, ...antesDe(fila.mes, fila.anio) },
    select: { cantidad: true, precioUnitario: true, mes: true, anio: true },
  })
  return NextResponse.json(toItemResponse(fila, referenciaDe(historico, { mes: fila.mes, anio: fila.anio })))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const existente = await prisma.listaCompraItem.findUnique({ where: { id } })
  if (!existente) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  // Sólo la línea del mes: el artículo queda en el catálogo (y su historial de precios).
  await prisma.listaCompraItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
