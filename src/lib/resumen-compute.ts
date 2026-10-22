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
  /**
   * Una fila por unidad del mes actual que entró en el cálculo de `total_proximo_mes`
   * (incluidas las excluidas por última cuota, con `estimado: 0`), para poder auditar
   * cómo se formó el total. La suma de `estimado` es `total_proximo_mes` (salvo redondeo).
   */
  detalle_proximo_mes: EstimadoDetalle[]
}

/**
 * Por qué una unidad aporta lo que aporta al estimado:
 * - `promedio`: promedio del mes actual con los meses previos (`historico`).
 * - `cuota_vigente`: está en cuotas y no es la última → se suma el monto tal cual.
 * - `ultima_cuota`: es la última cuota → no aporta (`estimado: 0`).
 */
export type CriterioEstimado = 'promedio' | 'cuota_vigente' | 'ultima_cuota'

export interface EstimadoHistorico {
  mes: number | null
  anio: number | null
  /** Monto del match en ese mes; `null` si no hubo match. */
  monto: number | null
  /** Si el mes entró al promedio (un mes sin match entra como 0 sólo con `missingBehavior = 'zero'`). */
  en_promedio: boolean
}

export interface EstimadoDetalle {
  /** Gastos que forman la fila (el gasto, o los resúmenes de tarjeta de los sub-items). */
  gasto_ids: number[]
  /** Cuántos gastos o sub-items del mismo concepto se sumaron en la fila. */
  cantidad: number
  concepto_id: number
  descripcion: string
  /** Descripción del gasto contenedor cuando la unidad es un grupo de sub-items. */
  gasto_padre: string | null
  es_subitem: boolean
  cuota_actual: number | null
  cuotas_totales: number | null
  monto_actual: number
  criterio: CriterioEstimado
  /** Vacío cuando el criterio no promedia. Ordenado del mes más cercano al más lejano. */
  historico: EstimadoHistorico[]
  estimado: number
}

type Unit = {
  gastoIds: number[]
  cantidad: number
  nombre: string
  padreNombre: string | null
  concepto: number
  monto: number
  cuotaActual: number | null
  cuotasTotales: number | null
  isSubitem: boolean
}

/**
 * Unidades del estimado de un mes, **una por clave**, sumando todo lo de la misma clave en el mes
 * antes de comparar con los meses previos (si no, dos gastos de "Luz" comparaban cada uno contra
 * el primer "Luz" del mes anterior y contaban dos veces sobre el histórico de uno solo). Cuotas: si
 * alguno del grupo las tiene, se conserva la primera vista.
 *
 * Qué entra:
 * - **Cada gasto, también los de crédito**, en su mes y por su concepto (clave `concepto`). Así un
 *   concepto es una sola fila sin importar si se pagó con débito o con qué tarjeta.
 * - **Del resumen de tarjeta, sólo los sub-items que no vienen de un gasto cargado** (`pagoId`
 *   nulo): las cuotas 2 en adelante y los cargos del banco (IVA, sellos, intereses…), que existen
 *   sólo ahí. Los propagados desde un pago ya están contados por su gasto con crédito. También por
 *   `concepto`, así la cuota 2/6 empalma con la 1/6 que se cargó como gasto. El total del resumen
 *   nunca es unidad: duplicaría los consumos.
 * - De un gasto común con sub-items, los sub-items (clave `gasto padre + concepto`).
 */
function buildUnits(gs: any[]): Map<string, Unit> {
  const out = new Map<string, Unit>()
  const agregar = (clave: string, u: Unit) => {
    const existing = out.get(clave)
    if (!existing) {
      out.set(clave, u)
      return
    }
    existing.monto += u.monto
    existing.cantidad += u.cantidad
    for (const id of u.gastoIds) if (!existing.gastoIds.includes(id)) existing.gastoIds.push(id)
    // Mezcla de orígenes (un gasto y un sub-item, o resúmenes de tarjetas distintas): sin padre único.
    existing.isSubitem = existing.isSubitem && u.isSubitem
    if (existing.padreNombre !== u.padreNombre) existing.padreNombre = null
    if (existing.cuotaActual == null && u.cuotaActual != null) {
      existing.cuotaActual = u.cuotaActual
      existing.cuotasTotales = u.cuotasTotales
    }
  }
  const subitem = (g: any, it: any): Unit => ({
    gastoIds: g.id != null ? [g.id] : [],
    cantidad: 1,
    nombre: it.concepto?.nombre ?? '',
    padreNombre: g.concepto?.nombre ?? '',
    concepto: it.conceptoId,
    monto: it.monto,
    cuotaActual: it.cuotaActual ?? null,
    cuotasTotales: it.cuotasTotales ?? null,
    isSubitem: true,
  })
  for (const g of gs) {
    const itemsIncl = g.items.filter((i: any) => i.incluyeEnTotal)
    if (g.esTarjeta) {
      for (const it of itemsIncl) if (it.pagoId == null) agregar(`g:${it.conceptoId}`, subitem(g, it))
      continue
    }
    if (itemsIncl.length > 0) {
      for (const it of itemsIncl) agregar(`s:${g.conceptoId}:${it.conceptoId}`, subitem(g, it))
    } else if (g.confirmado) {
      agregar(`g:${g.conceptoId}`, {
        gastoIds: g.id != null ? [g.id] : [],
        cantidad: 1,
        nombre: g.concepto?.nombre ?? '',
        padreNombre: null,
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

/**
 * Calcula el resumen mensual a partir de los gastos del mes (`gastos`, con
 * `pagos` e `items`), los gastos de los meses previos (`prevGastos`, con
 * `items`, uno por cada mes atrás), los settings de estimación, la fecha
 * `today` (YYYY-MM-DD local del usuario), los `ingresos` del mes y, opcional, el
 * período de cada elemento de `prevGastos` (`prevPeriodos[i]` ↔ `prevGastos[i]`) para
 * rotular el histórico del detalle del estimado.
 */
export function computeResumen(
  gastos: any[],
  prevGastos: any[][],
  settings: ResumenSettings,
  today: string,
  ingresos: IngresoRow[] = [],
  prevPeriodos: { mes: number; anio: number }[] = [],
): ResumenResult {
  const missingBehavior: 'zero' | 'average_found' =
    settings.estimMissingBehavior === 'average_found' ? 'average_found' : 'zero'
  const incluirCuotasVigentes = settings.estimIncluirCuotasVigentes
  const excluirUltimaCuota = settings.estimExcluirUltimaCuota

  let total_gastos = 0
  let total_pagado = 0
  let total_restante = 0
  let pagar_hoy = 0
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
    total_gastos += totalArs
    total_pagado += pagado
    total_restante += restante
    total_pasajes += g.pasajeMesSiguiente ?? 0
    if (g.tipoPago === 'C') total_tarjetas += totalArs
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
  const detalle: EstimadoDetalle[] = []
  const r = (n: number) => Math.round(n * 100) / 100
  for (const [clave, u] of Array.from(currentUnits)) {
    const base = {
      gasto_ids: u.gastoIds,
      cantidad: u.cantidad,
      concepto_id: u.concepto,
      descripcion: u.nombre,
      gasto_padre: u.isSubitem ? u.padreNombre : null,
      es_subitem: u.isSubitem,
      cuota_actual: u.cuotaActual,
      cuotas_totales: u.cuotasTotales,
      monto_actual: r(u.monto),
    }
    const tieneCuotas = u.cuotaActual != null && u.cuotasTotales != null
    if (tieneCuotas && excluirUltimaCuota && (u.cuotaActual as number) >= (u.cuotasTotales as number)) {
      detalle.push({ ...base, criterio: 'ultima_cuota', historico: [], estimado: 0 })
      continue
    }
    if (tieneCuotas && incluirCuotasVigentes) {
      total_proximo_mes += u.monto
      detalle.push({ ...base, criterio: 'cuota_vigente', historico: [], estimado: r(u.monto) })
      continue
    }
    // Promedio con meses previos
    const valores: number[] = [u.monto]
    const historico: EstimadoHistorico[] = []
    prevUnits.forEach((pu, i) => {
      const found = pu.get(clave)?.monto ?? null
      if (found !== null) valores.push(found)
      else if (missingBehavior === 'zero') valores.push(0)
      // si missingBehavior === 'average_found' → no agregamos nada
      historico.push({
        mes: prevPeriodos[i]?.mes ?? null,
        anio: prevPeriodos[i]?.anio ?? null,
        monto: found === null ? null : r(found),
        en_promedio: found !== null || missingBehavior === 'zero',
      })
    })
    const estimado = valores.reduce((s, v) => s + v, 0) / valores.length
    total_proximo_mes += estimado
    detalle.push({ ...base, criterio: 'promedio', historico, estimado: r(estimado) })
  }
  detalle.sort((x, y) => y.estimado - x.estimado || x.descripcion.localeCompare(y.descripcion))

  // El ahorro se mide contra lo gastado en débito/efectivo: la plata que efectivamente sale
  // de la cuenta. Los consumos de crédito no restan acá — restan cuando se paga el resumen.
  const ahorro = computeAhorro(ingresos, r(total_debito))
  return {
    total_gastos: r(total_gastos),
    total_gastos_neto: r(total_gastos - total_tarjetas - total_pasajes),
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
    detalle_proximo_mes: detalle,
  }
}
