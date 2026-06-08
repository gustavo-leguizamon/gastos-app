// Pure computation for the `/api/resumen` endpoint. Kept free of Prisma/Next
// imports so it can be unit-tested in isolation: the route fetches the rows and
// settings, then delegates all aggregation/estimation logic here.

export interface ResumenSettings {
  estimMesesAtras: number
  estimMissingBehavior: string
  estimIncluirCuotasVigentes: boolean
  estimExcluirUltimaCuota: boolean
}

export interface ResumenResult {
  total_gastos: number
  total_gastos_neto: number
  total_prestamos: number
  total_tarjetas: number
  total_pasajes: number
  total_restante: number
  total_restante_neto: number
  total_pagado: number
  pagar_hoy: number
  total_proximo_mes: number
}

type Unit = {
  parentDesc: string
  desc: string
  monto: number
  cuotaActual: number | null
  cuotasTotales: number | null
  isSubitem: boolean
}

const norm = (s: string) => s.trim().toLowerCase()

function buildUnits(gs: any[]): Unit[] {
  const out: Unit[] = []
  for (const g of gs) {
    if (!g.confirmado && g.items.length === 0) continue
    const itemsIncl = g.items.filter((i: any) => i.incluyeEnTotal)
    if (itemsIncl.length > 0) {
      // Agrupar sub-items del mismo gasto por descripción normalizada
      const grouped = new Map<string, Unit>()
      for (const it of itemsIncl) {
        const key = norm(it.descripcion)
        const existing = grouped.get(key)
        if (existing) {
          existing.monto += it.monto
          // Si alguno del grupo tiene cuotas, conservamos esa info (tomamos la primera vista)
          if (existing.cuotaActual == null && it.cuotaActual != null) {
            existing.cuotaActual = it.cuotaActual
            existing.cuotasTotales = it.cuotasTotales ?? null
          }
        } else {
          grouped.set(key, {
            parentDesc: norm(g.descripcion),
            desc: key,
            monto: it.monto,
            cuotaActual: it.cuotaActual ?? null,
            cuotasTotales: it.cuotasTotales ?? null,
            isSubitem: true,
          })
        }
      }
      grouped.forEach((u) => out.push(u))
    } else if (g.confirmado) {
      out.push({
        parentDesc: norm(g.descripcion),
        desc: norm(g.descripcion),
        monto: g.totalMoneda * g.tipoCambio,
        cuotaActual: g.cuotaActual ?? null,
        cuotasTotales: g.cuotasTotales ?? null,
        isSubitem: false,
      })
    }
  }
  return out
}

function findMatch(units: Unit[], target: Unit): number | null {
  for (const u of units) {
    if (target.isSubitem) {
      if (u.isSubitem && u.parentDesc === target.parentDesc && u.desc === target.desc) return u.monto
    } else {
      if (!u.isSubitem && u.desc === target.desc) return u.monto
    }
  }
  return null
}

/**
 * Calcula el resumen mensual a partir de los gastos del mes (`gastos`, con
 * `pagos` e `items`), los gastos de los meses previos (`prevGastos`, con
 * `items`, uno por cada mes atrás), los settings de estimación y la fecha
 * `today` (YYYY-MM-DD local del usuario).
 */
export function computeResumen(
  gastos: any[],
  prevGastos: any[][],
  settings: ResumenSettings,
  today: string,
): ResumenResult {
  const missingBehavior: 'zero' | 'average_found' =
    settings.estimMissingBehavior === 'average_found' ? 'average_found' : 'zero'
  const incluirCuotasVigentes = settings.estimIncluirCuotasVigentes
  const excluirUltimaCuota = settings.estimExcluirUltimaCuota

  let total_gastos = 0
  let total_pagado = 0
  let total_restante = 0
  let pagar_hoy = 0
  let total_prestamos = 0
  let total_tarjetas = 0
  let total_pasajes = 0

  for (const g of gastos) {
    if (!g.confirmado && g.items.length === 0) continue
    const totalArs = g.confirmado
      ? g.totalMoneda * g.tipoCambio
      : g.items.filter((i: any) => i.incluyeEnTotal).reduce((s: number, i: any) => s + i.monto, 0)
    const pagado = g.pagos.reduce((s: number, p: any) => s + p.monto, 0)
    const restante = totalArs - pagado
    const prestamo = g.prestamo_a_otro ?? 0
    total_gastos += totalArs
    total_pagado += pagado
    total_restante += restante
    total_prestamos += prestamo
    total_pasajes += g.pasajeMesSiguiente ?? 0
    if (g.tipoPago === 'C' && prestamo === 0) total_tarjetas += totalArs
    if (g.items.length > 0) {
      // Gasto con sub-items: sólo cuentan los sub-items marcados "incluir en vencimiento" cuya fecha sea hoy.
      const itemsHoy = g.items
        .filter((i: any) => i.incluyeEnVencimiento && i.fecha === today)
        .reduce((s: number, i: any) => s + i.monto, 0)
      pagar_hoy += itemsHoy
    } else if (g.fechaVencimiento === today) {
      // Gasto sin sub-items: vence por su propia fechaVencimiento.
      pagar_hoy += restante
    }
  }

  // Estimado próximo mes
  const currentUnits = buildUnits(gastos)
  const prevUnits = prevGastos.map(buildUnits)
  let total_proximo_mes = 0
  for (const u of currentUnits) {
    const tieneCuotas = u.cuotaActual != null && u.cuotasTotales != null
    if (tieneCuotas && excluirUltimaCuota && (u.cuotaActual as number) >= (u.cuotasTotales as number)) continue
    if (tieneCuotas && incluirCuotasVigentes) {
      total_proximo_mes += u.monto
      continue
    }
    // Promedio con meses previos
    const valores: number[] = [u.monto]
    for (const pu of prevUnits) {
      const found = findMatch(pu, u)
      if (found !== null) valores.push(found)
      else if (missingBehavior === 'zero') valores.push(0)
      // si missingBehavior === 'average_found' → no agregamos nada
    }
    if (valores.length === 0) continue
    total_proximo_mes += valores.reduce((s, v) => s + v, 0) / valores.length
  }

  const r = (n: number) => Math.round(n * 100) / 100
  return {
    total_gastos: r(total_gastos),
    total_gastos_neto: r(total_gastos - total_prestamos - total_tarjetas - total_pasajes),
    total_prestamos: r(total_prestamos),
    total_tarjetas: r(total_tarjetas),
    total_pasajes: r(total_pasajes),
    total_restante: r(total_restante),
    total_restante_neto: r(total_restante - total_pasajes),
    total_pagado: r(total_pagado),
    pagar_hoy: r(pagar_hoy),
    total_proximo_mes: r(total_proximo_mes),
  }
}
