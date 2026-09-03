import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isIconoDataUri } from '@/lib/imagen-icono'
import { parseBaja } from '@/lib/tarjetas-baja'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { nombre, banco, marca, banco_logo, banco_icono, baja_mes, baja_anio } = await req.json()
  const tarjeta = await prisma.tarjeta.update({
    where: { id: Number(params.id) },
    data: {
      nombre,
      banco: banco || null,
      marca: marca || null,
      bancoLogo: banco_logo || null,
      bancoIcono: isIconoDataUri(banco_icono) ? banco_icono : null,
      // Mandar el período incompleto (o nada) revierte la baja: es el camino para volver a
      // habilitar la tarjeta, así que un `null` acá tiene que llegar a la DB.
      ...parseBaja(baja_mes, baja_anio),
    },
  })
  return NextResponse.json({
    ...tarjeta,
    banco_logo: tarjeta.bancoLogo,
    banco_icono: tarjeta.bancoIcono,
    baja_mes: tarjeta.bajaMes ?? null,
    baja_anio: tarjeta.bajaAnio ?? null,
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.tarjeta.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
