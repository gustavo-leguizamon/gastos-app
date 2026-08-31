/**
 * Las dos bases contra las que se puede medir un presupuesto mensual.
 *
 * La app tenía dos definiciones de "lo gastado" que no eran comparables entre sí y vivían
 * en pantallas distintas:
 *
 * - El **ahorro del mes** (`computeAhorro`) se mide contra `total_debito`, que sólo cuenta
 *   `tipoPago === 'D'` — la plata que efectivamente sale de la cuenta. Criterio de **caja**.
 * - El **presupuesto por categoría** se mide contra `computeReportes` con `esTarjeta: false`
 *   — débito más cada consumo de crédito individual. Criterio **devengado**.
 *
 * Mezclarlas hace que un objetivo de ahorro repartido en topes por categoría no cierre: se
 * pueden cumplir todos los topes y que el ahorro medido no dé, o al revés. En vez de elegir
 * una y esconder la otra, las dos se calculan acá, con la misma forma de salida, para poder
 * mostrarlas lado a lado.
 *
 * Que las dos definiciones vivan en la misma función es lo que impide que las pantallas se
 * contradigan: cualquiera que necesite "lo gastado por categoría" pasa por acá y dice cuál
 * de las dos quiere.
 */

import {
  computeReportes,
  computeReporteSubitems,
  gastoTotalArs,
  type CategoriaBucket,
} from './reportes-compute'

export type BasePresupuesto = 'devengado' | 'caja'

/**
 * Piso a partir del cual una diferencia de atribución se considera real.
 *
 * Un resumen con decenas de sub-ítems arrastra centavos de redondeo (los montos se cargan ya
 * redondeados, y su suma no da exactamente el total del resumen). Sin este piso, 13 centavos
 * de deriva sobre millones se reportarían como un problema. Un ítem que falta de verdad es de
 * otro orden de magnitud.
 */
export const UMBRAL_NO_ATRIBUIDO = 1

export interface GastadoBase {
  base: BasePresupuesto
  /** Gasto atribuido a cada categoría (incluye la fila `id: null`, "Sin categoría"). */
  por_categoria: CategoriaBucket[]
  /** Suma de lo atribuido. */
  total: number
  /**
   * Monto del mes que la base **no pudo atribuir** a ninguna categoría: total real de los
   * gastos que participan menos lo atribuido. Positivo = falta atribuir.
   *
   * En devengado es siempre 0 (cada gasto aporta su total entero). En caja puede no serlo:
   * el desglose por sub-ítem usa el monto de cada sub-ítem tal cual, así que si un resumen
   * de tarjeta tiene sub-ítems que no cierran contra su total, la diferencia no aparece en
   * ninguna categoría. Se expone en vez de disimularse — es un error de carga del dato, y
   * si se repartiera silenciosamente el presupuesto quedaría mal armado.
   *
   * Las diferencias menores a `UMBRAL_NO_ATRIBUIDO` se reportan como 0: son redondeo, no un
   * dato que falte.
   */
  no_atribuido: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Los gastos del mes que participan de cada base.
 *
 * - **Devengado**: todo menos los resúmenes de tarjeta. El resumen es un contenedor de
 *   consumos que ya existen como gastos propios; contarlo además duplicaría el consumo.
 * - **Caja**: los `tipoPago === 'D'`, que **incluye los resúmenes** — se crean con
 *   `tipoPago: 'D'` (`gastos/[id]/pagos/route.ts`) justamente porque pagar la tarjeta es una
 *   salida de la cuenta. Es el mismo conjunto que suma `total_debito` en el resumen, así que
 *   esta base no puede contradecir el KPI de ahorro del dashboard.
 */
export function gastosDeBase(gastos: any[], base: BasePresupuesto): any[] {
  return base === 'caja'
    ? (gastos ?? []).filter(g => g.tipoPago === 'D')
    : (gastos ?? []).filter(g => !g.esTarjeta)
}

/**
 * Lo gastado por categoría en un período, según la base elegida.
 *
 * La diferencia entre las dos no es sólo qué gastos entran, sino **a qué nivel se atribuye**:
 *
 * - Devengado agrega a nivel gasto (`computeReportes`): cada gasto cuenta una vez con su
 *   categoría. Es exactamente la métrica del reporte por categoría, así que el panel de
 *   presupuestos y el reporte no pueden mostrar números distintos.
 * - Caja agrega por sub-ítem (`computeReporteSubitems`): sin esto el pago del resumen caería
 *   entero en la categoría del contenedor ("Tarjeta crédito") y el presupuesto por categoría
 *   en caja no diría nada. Los sub-ítems del resumen llevan la `categoriaId` heredada del
 *   gasto que los originó, así que el pago se reparte en las categorías de sus consumos. Los
 *   gastos de débito sin sub-ítems caen a su propia categoría (el fallback ya existente).
 */
export function gastadoPorCategoria(
  gastos: any[],
  base: BasePresupuesto,
  months: { mes: number; anio: number }[],
): GastadoBase {
  const participan = gastosDeBase(gastos, base)

  const reporte = base === 'caja'
    ? computeReporteSubitems(participan, months)
    : computeReportes(participan, months)

  const real = participan.reduce((s, g) => s + gastoTotalArs(g), 0)
  const diferencia = r2(real - reporte.kpis.total)

  return {
    base,
    por_categoria: reporte.por_categoria,
    total: reporte.kpis.total,
    no_atribuido: Math.abs(diferencia) < UMBRAL_NO_ATRIBUIDO ? 0 : diferencia,
  }
}
