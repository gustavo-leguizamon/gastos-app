import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { estadoCiclo } from '@/lib/cierres'

// Devuelve TODAS las tarjetas con el estado de su ciclo en el (mes, anio) consultado,
// ordenadas por el próximo cierre: primero las que ya cerraron, después las que están por
// cerrar, y al final las que no tienen el cierre cargado (la sección es también el lugar
// donde se nota que falta configurarlo). El corte cerrado/abierto se decide contra `today`
// (YYYY-MM-DD local del cliente, no la fecha UTC del server).
// Se usa en el dashboard de /gastos.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mes = Number(searchParams.get('mes'))
  const anio = Number(searchParams.get('anio'))
  const today = searchParams.get('today')

  if (!mes || !anio || !today) {
    return NextResponse.json([], { status: 200 })
  }

  const tarjetas = await prisma.tarjeta.findMany({
    include: { cierres: { where: { mes, anio } } },
  })

  const items = tarjetas.map(t => {
    const cierre = t.cierres[0] ?? null
    const ciclo = estadoCiclo(cierre, today)
    return {
      id: t.id,
      nombre: t.nombre,
      banco: t.banco,
      marca: t.marca,
      banco_logo: t.bancoLogo,
      banco_icono: t.bancoIcono,
      fecha_cierre: cierre?.fechaCierre ?? null,
      fecha_vencimiento: cierre?.fechaVencimiento ?? null,
      fecha_proximo_cierre: cierre?.fechaProximoCierre ?? null,
      estado: ciclo.estado,
      dias_para_cierre: ciclo.dias,
      progreso: ciclo.progreso,
    }
  })

  // Por próximo cierre ascendente; las que no lo tienen van al final (nunca intercaladas),
  // y entre iguales manda el nombre para que el orden no dependa del de la DB.
  items.sort((a, b) => {
    if (a.fecha_proximo_cierre !== b.fecha_proximo_cierre) {
      if (!a.fecha_proximo_cierre) return 1
      if (!b.fecha_proximo_cierre) return -1
      return a.fecha_proximo_cierre.localeCompare(b.fecha_proximo_cierre)
    }
    return a.nombre.localeCompare(b.nombre)
  })

  return NextResponse.json(items)
}
