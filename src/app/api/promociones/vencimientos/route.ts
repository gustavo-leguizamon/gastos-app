import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { promocionesConProgreso } from '@/lib/promociones-db'
import { reintegrosPendientes } from '@/lib/promociones-compute'

// Lee la DB sin recibir `req`: sin esto Next lo prerenderiza en el build.
export const dynamic = 'force-dynamic'

/**
 * `GET /api/promociones/vencimientos` — los reintegros **pendientes de usar** que tienen fecha de
 * vencimiento, de **cualquier mes** (el reintegro de octubre puede vencer en diciembre, así que
 * no depende del período que se esté mirando), con lo que hay para usar en cada uno.
 *
 * El monto es lo reintegrado de esa promo en el mes de origen (se calcula, no se guarda). Los de
 * monto 0 no se listan: no hay nada que perder. Orden: los que vencen antes primero; el cliente
 * decide el color según los días que faltan (`estadoVencimiento`) porque la fecha de hoy es suya.
 */
export async function GET() {
  const filas = await prisma.promocionReintegro.findMany({
    where: { utilizado: false, venceEl: { not: null } },
    select: { promocionId: true, mes: true, anio: true, venceEl: true, utilizado: true },
  })

  // Un cálculo de progreso por mes de origen (una query de gastos cada uno).
  const grupos = new Map<string, typeof filas>()
  for (const f of filas) {
    const k = `${anioMes(f)}`
    grupos.set(k, [...(grupos.get(k) ?? []), f])
  }

  const items: {
    promocion_id: number
    lugar: string
    mes: number
    anio: number
    vence_el: string | null
    utilizado: boolean
    reintegrado: number
  }[] = []

  for (const grupo of Array.from(grupos.values())) {
    const { mes, anio } = grupo[0]
    const promos = await prisma.promocion.findMany({
      where: { id: { in: grupo.map(g => g.promocionId) } },
      include: { conceptos: true, tarjetas: true, usos: { where: { mes, anio } } },
    })
    const conProgreso = await promocionesConProgreso(promos, mes, anio)
    for (const g of grupo) {
      const p = conProgreso.find(x => x.id === g.promocionId)
      if (!p || p.progreso.reintegrado <= 0) continue
      items.push({
        promocion_id: p.id,
        lugar: p.lugar,
        mes,
        anio,
        vence_el: g.venceEl,
        utilizado: g.utilizado,
        reintegrado: p.progreso.reintegrado,
      })
    }
  }

  return NextResponse.json(reintegrosPendientes(items))
}

function anioMes(f: { mes: number; anio: number }) {
  return `${f.anio}-${f.mes}`
}
