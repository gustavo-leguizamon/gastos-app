import { prisma } from '@/lib/db'
import {
  toPromocionResponse,
  toUsoResponse,
  consumoAutomatico,
  progresoPromocion,
  vigenteEnMes,
} from '@/lib/promociones-compute'

/**
 * Promociones (filas de Prisma con `conceptos`, `tarjetas` y los `usos` del período incluidos)
 * con su **progreso en `(mes, anio)`**: consumo de los gastos asociados + usos manuales, y si
 * están vigentes en ese mes. Lo comparten el listado y las sugerencias del form de gasto, para
 * que las dos pantallas no puedan calcular distinto "cuánto queda".
 *
 * Una sola query de gastos para todas las promos (no una por promo). Vive fuera de las routes
 * porque Next no admite exports extra en un `route.ts`.
 */
export async function promocionesConProgreso(promociones: any[], mes: number, anio: number) {
  const ids = promociones.map(p => p.id)
  const gastos = ids.length
    ? await prisma.gasto.findMany({
        where: { mes, anio, promocionId: { in: ids } },
        select: { promocionId: true, totalMoneda: true, tipoCambio: true },
      })
    : []

  return promociones.map(p => {
    const base = toPromocionResponse(p)
    const usos: any[] = p.usos ?? []
    const manual = usos.reduce((s, u) => s + u.montoGasto, 0)
    const auto = consumoAutomatico(p.id, gastos)
    return {
      ...base,
      /** Vigente en el período consultado (`activa` es el interruptor manual, aparte). */
      vigente: vigenteEnMes(p, mes, anio),
      usos: usos.map(toUsoResponse),
      progreso: progresoPromocion({ porcentaje: p.porcentaje, topeMensual: p.topeMensual }, auto, manual),
    }
  })
}
