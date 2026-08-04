import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isIconoDataUri } from '@/lib/imagen-icono'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { nombre, banco, marca, banco_logo, banco_icono } = await req.json()
  const tarjeta = await prisma.tarjeta.update({
    where: { id: Number(params.id) },
    data: {
      nombre,
      banco: banco || null,
      marca: marca || null,
      bancoLogo: banco_logo || null,
      bancoIcono: isIconoDataUri(banco_icono) ? banco_icono : null,
    },
  })
  return NextResponse.json({ ...tarjeta, banco_logo: tarjeta.bancoLogo, banco_icono: tarjeta.bancoIcono })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.tarjeta.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
