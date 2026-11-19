import { prisma } from '@/lib/db'
import {
  toPromocionResponse,
  toReintegroResponse,
  toSaldoUsoResponse,
  toUsoResponse,
  cicloDeFecha,
  consumoEnCiclo,
  diaReinicioDe,
  lotesPromocion,
  progresoPromocion,
  rangoCiclo,
  saldoPromocion,
  vigenteEnCiclo,
} from '@/lib/promociones-compute'

/**
 * Qué ciclo mirar de cada promo:
 * - `{ mes, anio }`: el ciclo que **empieza** en ese mes (con reinicio el 1, el mes calendario).
 * - `{ fecha }`: el ciclo **en curso** a esa fecha, que depende del día de reinicio de cada promo
 *   (con reinicio el 5, el 03/12 todavía es el ciclo de noviembre).
 */
export type PeriodoPromo = { mes: number; anio: number } | { fecha: string }

export function cicloDePeriodo(promo: { diaReinicio?: number | null }, periodo: PeriodoPromo) {
  if ('fecha' in periodo) {
    return cicloDeFecha(periodo.fecha, diaReinicioDe(promo)) ?? { mes: 1, anio: 1970 }
  }
  return { mes: periodo.mes, anio: periodo.anio }
}

const SELECT_GASTO = {
  promocionId: true, mes: true, anio: true, promocionFecha: true, totalMoneda: true, tipoCambio: true,
} as const

/**
 * Promociones (filas de Prisma con `conceptos`, `categorias`, `etiquetas` y `tarjetas` incluidos)
 * con su **progreso en el ciclo** que pide `periodo`: consumo de los gastos asociados + usos
 * manuales, y si están vigentes en ese ciclo. Lo comparten el listado y las sugerencias del form
 * de gasto, para que las dos pantallas no puedan calcular distinto "cuánto queda".
 *
 * Con `saldoAl` (fecha `YYYY-MM-DD`) agrega el **saldo a favor** de cada promo a ese día, que
 * necesita el histórico completo (todos los ciclos con reintegro, sus vencimientos y los usos del
 * saldo); en ese caso los gastos y usos se traen enteros y el ciclo pedido se filtra en memoria.
 * Sin `saldoAl` sólo se traen los del rango de los ciclos pedidos.
 *
 * Una query por tabla para todas las promos (no una por promo). Vive fuera de las routes
 * porque Next no admite exports extra en un `route.ts`.
 */
export async function promocionesConProgreso(
  promociones: any[],
  periodo: PeriodoPromo,
  opts: { saldoAl?: string } = {},
) {
  const ids = promociones.map(p => p.id)
  const ciclos = promociones.map(p => cicloDePeriodo(p, periodo))
  const rangos = promociones.map((p, i) => rangoCiclo(ciclos[i].mes, ciclos[i].anio, diaReinicioDe(p)))
  const conSaldo = !!opts.saldoAl

  let gastos: any[] = []
  let usos: any[] = []
  let reintegros: any[] = []
  let saldoUsos: any[] = []

  if (ids.length) {
    // Sin saldo: los gastos del rango de los ciclos pedidos — los que no tienen fecha de compra
    // caen por su mes, y los que la tienen, por la fecha. El ciclo exacto se filtra en memoria.
    const desde = rangos.map(r => r.desde).sort()[0]
    const hasta = rangos.map(r => r.hasta).sort().reverse()[0]
    const meses = Array.from(new Map(ciclos.map(c => [`${c.anio}-${c.mes}`, c])).values())
    const whereGasto = conSaldo
      ? { promocionId: { in: ids } }
      : {
          promocionId: { in: ids },
          OR: [
            { promocionFecha: null, OR: meses.map(c => ({ mes: c.mes, anio: c.anio })) },
            { promocionFecha: { gte: desde, lte: hasta } },
          ],
        }
    // Los usos manuales se guardan con su mes calendario; el ciclo sale de la fecha.
    const whereUso = conSaldo
      ? { promocionId: { in: ids } }
      : { promocionId: { in: ids }, fecha: { gte: desde, lte: hasta } }

    ;[gastos, usos, reintegros, saldoUsos] = await Promise.all([
      prisma.gasto.findMany({ where: whereGasto, select: SELECT_GASTO }),
      prisma.promocionUso.findMany({ where: whereUso, orderBy: [{ fecha: 'desc' }, { id: 'desc' }] }),
      conSaldo ? prisma.promocionReintegro.findMany({ where: { promocionId: { in: ids } } }) : Promise.resolve([]),
      conSaldo
        ? prisma.promocionSaldoUso.findMany({ where: { promocionId: { in: ids } }, orderBy: [{ fecha: 'desc' }, { id: 'desc' }] })
        : Promise.resolve([]),
    ])
  }

  return promociones.map((p, i) => {
    const base = toPromocionResponse(p)
    const ciclo = ciclos[i]
    const dia = diaReinicioDe(p)
    const susGastos = gastos.filter(g => g.promocionId === p.id)
    const susUsos = usos.filter(u => u.promocionId === p.id)
    const susReintegros = reintegros.filter(r => r.promocionId === p.id)
    const { auto, manual } = consumoEnCiclo(p, ciclo, susGastos, susUsos)
    const usosDelCiclo = susUsos.filter(u => {
      const c = cicloDeFecha(u.fecha, dia)
      return c && c.mes === ciclo.mes && c.anio === ciclo.anio
    })

    const item: any = {
      ...base,
      /** Ciclo que se está mirando de esta promo, con sus fechas. */
      ciclo: { mes: ciclo.mes, anio: ciclo.anio, ...rangos[i] },
      /** Vigente en el ciclo consultado (`activa` es el interruptor manual, aparte). */
      vigente: vigenteEnCiclo(p, ciclo.mes, ciclo.anio),
      usos: usosDelCiclo.map(toUsoResponse),
      /** Vencimiento cargado del reintegro de ESTE ciclo (`null` = nada cargado). */
      reintegro: toReintegroResponse(susReintegros.find(r => r.mes === ciclo.mes && r.anio === ciclo.anio)),
      progreso: progresoPromocion({ porcentaje: p.porcentaje, topeMensual: p.topeMensual }, auto, manual),
    }

    if (conSaldo) {
      const susSaldoUsos = saldoUsos.filter(u => u.promocionId === p.id)
      const lotes = lotesPromocion(p, susGastos, susUsos, susReintegros)
      item.saldo = saldoPromocion(lotes, susSaldoUsos, opts.saldoAl as string)
      item.saldo_usos = susSaldoUsos.map(toSaldoUsoResponse)
    }
    return item
  })
}
