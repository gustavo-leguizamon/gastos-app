import type { ConceptoDefaults } from '@/lib/types'

/**
 * Defaults aprendidos por concepto: al elegir en el alta un concepto ya usado, el formulario
 * se prefillea con los valores del **último gasto** de ese concepto en vez de arrancar vacío.
 *
 * El criterio de "último" es el mismo orden que usa el resto de la app para el histórico por
 * concepto (anio, mes, id descendente) — ver `ULTIMO_USO_ORDER_BY`.
 *
 * Contrato deliberado: `es_tarjeta`, `notas`, `cuota_actual`/`cuotas_totales`, `pasaje_mes_siguiente`
 * y `prestamo_a_otro` **no** se heredan. Son propios de la ocurrencia puntual (un resumen de
 * tarjeta, una nota de ese mes, una cuota 3/12 que el mes que viene es 4/12), no del concepto:
 * copiarlos generaría datos incorrectos en silencio.
 */

/** `orderBy` de Prisma para resolver el último gasto de un concepto. */
export const ULTIMO_USO_ORDER_BY = [
  { anio: 'desc' as const },
  { mes: 'desc' as const },
  { id: 'desc' as const },
]

/** Forma mínima (camelCase, como viene de Prisma) que necesita `toConceptoDefaults`. */
export interface UltimoUsoGasto {
  casaId: number
  tipoPago: string
  monedaId: number
  tipoCambio: number
  tarjetaId: number | null
  categoriaId: number | null
  etiquetas?: { id: number }[]
  totalMoneda: number
  mes: number
  anio: number
}

/**
 * Mapea el último gasto del concepto a los defaults del formulario (camelCase → snake_case).
 * Devuelve `null` si no hay gasto previo: el concepto es nuevo y el alta queda con sus defaults
 * globales (no hay nada que aprender todavía).
 */
export function toConceptoDefaults(gasto: UltimoUsoGasto | null | undefined): ConceptoDefaults | null {
  if (!gasto) return null

  return {
    casa_id: gasto.casaId,
    // El schema sólo admite 'C' | 'D'; cualquier otro valor histórico cae a débito.
    tipo_pago: gasto.tipoPago === 'C' ? 'C' : 'D',
    moneda_id: gasto.monedaId,
    tipo_cambio: gasto.tipoCambio,
    // Una tarjeta sólo tiene sentido como default si el pago era con crédito.
    tarjeta_id: gasto.tipoPago === 'C' ? gasto.tarjetaId ?? null : null,
    categoria_id: gasto.categoriaId ?? null,
    etiqueta_ids: (gasto.etiquetas ?? []).map(e => e.id),
    total_moneda: gasto.totalMoneda,
    origen: { mes: gasto.mes, anio: gasto.anio },
  }
}
