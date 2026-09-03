import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { estadoCiclo } from '@/lib/cierres'
import { tarjetasActivasEn } from '@/lib/tarjetas-baja'

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

  // Las dadas de baja en el período no van: la sección es "en qué punto del ciclo está cada
  // tarjeta este mes", y una tarjeta que ya no se tiene no tiene ciclo. Se filtra en memoria
  // (son pocas filas) para que la condición viva en `tarjetaActivaEn` y no en un `OR` de
  // Prisma que hay que leer dos veces.
  const items = tarjetasActivasEn(tarjetas, mes, anio).map(t => {
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

  // Por el cierre que la tarjeta tiene por delante, ascendente: las que ya cerraron primero y
  // después las que están por cerrar, más cerca antes. Para una `por_cerrar` ese cierre es su
  // propia `fechaCierre` (no tiene próximo cierre cargado) — ordenarla por imminencia junto a
  // las demás y no al final, que es donde quedan sólo las que no tienen ninguna fecha.
  // Entre iguales manda el nombre, para que el orden no dependa del de la DB.
  const proximo = (t: (typeof items)[number]) =>
    t.fecha_proximo_cierre ?? (t.estado === 'por_cerrar' ? t.fecha_cierre : null)

  items.sort((a, b) => {
    const [pa, pb] = [proximo(a), proximo(b)]
    if (pa !== pb) {
      if (!pa) return 1
      if (!pb) return -1
      return pa.localeCompare(pb)
    }
    return a.nombre.localeCompare(b.nombre)
  })

  return NextResponse.json(items)
}
