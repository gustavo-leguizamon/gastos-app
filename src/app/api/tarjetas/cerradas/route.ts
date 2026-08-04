import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Devuelve las tarjetas cuyo TarjetaCierre del (mes, anio) consultado tiene
// fechaProximoCierre seteada y MENOR a `today` (YYYY-MM-DD local).
// Se usa en el dashboard de /gastos para listar tarjetas "que ya cerraron".
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mes = Number(searchParams.get('mes'))
  const anio = Number(searchParams.get('anio'))
  const today = searchParams.get('today')

  if (!mes || !anio || !today) {
    return NextResponse.json([], { status: 200 })
  }

  const cierres = await prisma.tarjetaCierre.findMany({
    where: {
      mes,
      anio,
      fechaProximoCierre: { not: null, lt: today },
    },
    include: { tarjeta: true },
    orderBy: { fechaProximoCierre: 'asc' },
  })

  return NextResponse.json(cierres.map(c => ({
    id: c.tarjeta.id,
    nombre: c.tarjeta.nombre,
    banco: c.tarjeta.banco,
    marca: c.tarjeta.marca,
    banco_logo: c.tarjeta.bancoLogo,
    banco_icono: c.tarjeta.bancoIcono,
    fecha_cierre: c.fechaCierre,
    fecha_vencimiento: c.fechaVencimiento,
    fecha_proximo_cierre: c.fechaProximoCierre,
  })))
}
