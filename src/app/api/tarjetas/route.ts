import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isIconoDataUri } from '@/lib/imagen-icono'
import { parseBaja, tarjetasActivasEn } from '@/lib/tarjetas-baja'

// Devuelve **todas** las tarjetas por defecto, dadas de baja incluidas: /configuracion las
// necesita para poder revertir la baja, y /reportes y la grilla de gastos para no perder los
// logos ni la clasificación del histórico. Con `?mes=&anio=` se recorta a las vigentes en ese
// período — lo que usan los selects de /gastos, donde ofrecer una tarjeta que ya no se tiene
// sería un error de carga esperando a pasar.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mes = Number(searchParams.get('mes'))
  const anio = Number(searchParams.get('anio'))

  const tarjetas = await prisma.tarjeta.findMany({
    orderBy: { nombre: 'asc' },
    include: { cierres: true },
  })
  const visibles = mes && anio ? tarjetasActivasEn(tarjetas, mes, anio) : tarjetas

  return NextResponse.json(visibles.map(t => ({
    id: t.id,
    nombre: t.nombre,
    banco: t.banco,
    marca: t.marca,
    banco_logo: t.bancoLogo,
    banco_icono: t.bancoIcono,
    baja_mes: t.bajaMes ?? null,
    baja_anio: t.bajaAnio ?? null,
    cierres: t.cierres.map(c => ({
      id: c.id,
      tarjeta_id: c.tarjetaId,
      mes: c.mes,
      anio: c.anio,
      fecha_cierre: c.fechaCierre ?? null,
      fecha_vencimiento: c.fechaVencimiento ?? null,
      fecha_proximo_cierre: c.fechaProximoCierre ?? null,
      created_at: c.createdAt.toISOString(),
      updated_at: c.updatedAt.toISOString(),
    })),
  })))
}

export async function POST(req: NextRequest) {
  const { nombre, banco, marca, banco_logo, banco_icono, baja_mes, baja_anio } = await req.json()
  const tarjeta = await prisma.tarjeta.create({
    data: {
      nombre,
      banco: banco || null,
      marca: marca || null,
      bancoLogo: banco_logo || null,
      bancoIcono: isIconoDataUri(banco_icono) ? banco_icono : null,
      // Se acepta en el alta para poder cargar una tarjeta que ya no se tiene, sólo para
      // imputarle gastos viejos, sin pasar por un segundo guardado.
      ...parseBaja(baja_mes, baja_anio),
    },
  })
  return NextResponse.json(
    {
      ...tarjeta,
      banco_logo: tarjeta.bancoLogo,
      banco_icono: tarjeta.bancoIcono,
      baja_mes: tarjeta.bajaMes ?? null,
      baja_anio: tarjeta.bajaAnio ?? null,
    },
    { status: 201 },
  )
}
