// Pure computation for the `/api/resumen` endpoint. Kept free of Prisma/Next
// imports so it can be unit-tested in isolation: the route fetches the rows and
// settings, then delegates all aggregation/estimation logic here.

import { vencePorGasto } from './vencimientos'
import { computeAhorro, type IngresoRow } from './ingresos-compute'

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
  /**
   * Lo que ya venció y sigue impago, **dentro del mes consultado** (el resumen sólo
   * carga ese mes, igual que todas las demás cards). El push diario mira además el mes
   * anterior, para que un atraso no desaparezca al cambiar de mes.
   */
  total_vencido: number
  total_proximo_mes: number
  /** Suma de los ingresos cargados para el mes (varias entradas, ver `Ingreso`). */
  total_ingresos: number
  /**
   * Lo gastado en débito/efectivo: `SUM(total_ars)` de los gastos con `tipoPago === 'D'`,
   * estén pagados o no. Incluye los resúmenes de tarjeta (que se cargan como débito, porque
   * el resumen se paga de la cuenta) y excluye los consumos de crédito individuales, que ya
   * están representados dentro de esos resúmenes — así no se cuenta dos veces.
   */
  total_debito: number
  /** `total_ingresos − total_debito`: cuánta de la plata que entró todavía no salió. */
  total_ahorro: number
  /** `total_ahorro` como % de `total_ingresos` (0 si no hay ingresos cargados). */
  ahorro_pct: number
}

type Unit = {
  parentConcepto: number
  concepto: number
  monto: number
  cuotaActual: number | null
  cuotasTotales: number | null
  isSubitem: boolean
}

function buildUnits(gs: any[]): Unit[] {
  const out: Unit[] = []
  for (const g of gs) {
    if (!g.confirmado && g.items.length === 0) continue
    const itemsIncl = g.items.filter((i: any) => i.incluyeEnTotal)
    if (itemsIncl.length > 0) {
      // Agrupar sub-items del mismo gasto por concepto
      const grouped = new Map<number, Unit>()
      for (const it of itemsIncl) {
        const key = it.conceptoId
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
            parentConcepto: g.conceptoId,
            concepto: key,
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
        parentConcepto: g.conceptoId,
        concepto: g.conceptoId,
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
      if (u.isSubitem && u.parentConcepto === target.parentConcepto && u.concepto === target.concepto) return u.monto
    } else {
      if (!u.isSubitem && u.concepto === target.concepto) return u.monto
    }
  }
  return null
}

/**
 * Calcula el resumen mensual a partir de los gastos del mes (`gastos`, con
 * `pagos` e `items`), los gastos de los meses previos (`prevGastos`, con
 * `items`, uno por cada mes atrás), los settings de estimación, la fecha
 * `today` (YYYY-MM-DD local del usuario) y los `ingresos` del mes.
 */
export function computeResumen(
  gastos: any[],
  prevGastos: any[][],
  settings: ResumenSettings,
  today: string,
  ingresos: IngresoRow[] = [],
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
  let total_debito = 0
  let total_vencido = 0

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
    // Débito/efectivo — la plata que sale de la cuenta. Es la base del ahorro del mes.
    if (g.tipoPago === 'D') total_debito += totalArs
    if (vencePorGasto(g.esTarjeta, g.items.length)) {
      // Gasto sin sub-items (o resumen de tarjeta): vence por su propia fechaVencimiento.
      if (g.fechaVencimiento === today) pagar_hoy += restante
      else if (g.fechaVencimiento < today && restante > 0) total_vencido += restante
    } else {
      // Gasto con sub-items: sólo cuentan los sub-items marcados "incluir en vencimiento" cuya fecha sea hoy.
      pagar_hoy += g.items
        .filter((i: any) => i.incluyeEnVencimiento && i.fecha === today)
        .reduce((s: number, i: any) => s + i.monto, 0)
      // Los sub-items pasados sólo cuentan como vencidos si el gasto padre sigue con saldo:
      // un sub-item no tiene estado de pago propio, así que el restante del padre es el único
      // indicio de que todavía hay algo que pagar (ver `vencimientosPendientes`).
      if (restante > 0) {
        total_vencido += g.items
          .filter((i: any) => i.incluyeEnVencimiento && i.fecha && i.fecha < today)
          .reduce((s: number, i: any) => s + i.monto, 0)
      }
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
  // El ahorro se mide contra lo gastado en débito/efectivo: la plata que efectivamente sale
  // de la cuenta. Los consumos de crédito no restan acá — restan cuando se paga el resumen.
  const ahorro = computeAhorro(ingresos, r(total_debito))
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
    total_vencido: r(total_vencido),
    total_proximo_mes: r(total_proximo_mes),
    total_ingresos: ahorro.total_ingresos,
    total_debito: r(total_debito),
    total_ahorro: ahorro.ahorro,
    ahorro_pct: ahorro.ahorro_pct,
  }
}
