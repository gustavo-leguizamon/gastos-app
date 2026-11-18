import { prisma } from '@/lib/db'

// Lógica de "Copiar" un gasto a otro mes, compartida por `POST /api/gastos/copiar` (los
// dialogs de copia) y el cron `GET /api/cron/copiar-tarjetas` (copia automática del resumen
// de tarjeta al mes siguiente). Toca Prisma, así que se cubre vía los tests de esas routes.

export type CopiarGastoResult =
  | { status: 'not_found' }
  | { status: 'merged'; gasto_id: number; added_items: number }
  | { status: 'created'; gasto_id: number; added_items: number }

// Cuota a usar al copiar: si está en cuotas y no finalizaron, +1.
export function nextCuota(item: { cuotaActual: number | null; cuotasTotales: number | null }) {
  if (item.cuotaActual != null && item.cuotasTotales != null && item.cuotaActual < item.cuotasTotales) {
    return item.cuotaActual + 1
  }
  return item.cuotaActual
}

/**
 * Copia un gasto (+ sub-items) al mes/año destino con merge:
 * - Si ya existe un gasto en el destino (mismo concepto + mes + año + casa), no crea uno
 *   nuevo: agrega sólo los sub-items que no existan ya (por conceptoId).
 * - Si no existe, crea el gasto (reset de pagos/montos, confirmado=false) y todos sus sub-items.
 * - Para gastos `esTarjeta`, sólo se consideran sub-items con cuotas pendientes.
 * - Gasto y sub-items en cuotas no finalizadas se copian con cuotaActual + 1.
 */
export async function copiarGasto(sourceId: number, mes: number, anio: number): Promise<CopiarGastoResult> {
  const source = await prisma.gasto.findUnique({
    where: { id: sourceId },
    include: { items: { include: { etiquetas: true } }, etiquetas: true },
  })
  if (!source) return { status: 'not_found' }

  const diaVenc = source.fechaVencimiento.split('-')[2] ?? '01'
  const nuevaFecha = `${anio}-${String(mes).padStart(2, '0')}-${diaVenc}`

  // Sub-items candidatos a copiar
  const candidatos = source.esTarjeta
    ? source.items.filter(i => i.cuotaActual != null && i.cuotasTotales != null && i.cuotaActual < i.cuotasTotales)
    : source.items

  // ¿Existe ya el gasto en el destino?
  const existente = await prisma.gasto.findFirst({
    where: {
      casaId: source.casaId,
      mes,
      anio,
      conceptoId: source.conceptoId,
    },
    include: { items: true },
  })

  const itemCreateData = (item: typeof source.items[number], gastoId: number) => ({
    gastoId,
    conceptoId: item.conceptoId,
    monto: item.monto,
    fecha: item.fecha,
    cuotaActual: nextCuota(item),
    cuotasTotales: item.cuotasTotales,
    incluyeEnTotal: item.incluyeEnTotal,
    incluyeEnVencimiento: item.incluyeEnVencimiento,
    categoriaId: item.categoriaId,
    etiquetas: { connect: (item.etiquetas ?? []).map((c: any) => ({ id: c.id })) },
  })

  if (existente) {
    // Merge: agregar sólo los sub-items que no existan (por conceptoId)
    const existentesConcepto = new Set(existente.items.map(i => i.conceptoId))
    const nuevos = candidatos.filter(i => !existentesConcepto.has(i.conceptoId))
    await Promise.all(nuevos.map(i => prisma.gastoItem.create({ data: itemCreateData(i, existente.id) })))
    return { status: 'merged', gasto_id: existente.id, added_items: nuevos.length }
  }

  // Crear gasto nuevo + sub-items
  const nuevo = await prisma.gasto.create({
    data: {
      casaId: source.casaId,
      conceptoId: source.conceptoId,
      fechaVencimiento: nuevaFecha,
      tipoPago: source.tipoPago,
      monedaId: source.monedaId,
      tipoCambio: source.tipoCambio,
      totalMoneda: source.totalMoneda,
      totalPagado: 0,
      pasajeMesSiguiente: 0,
      tarjetaId: source.tarjetaId,
      cuotaActual: nextCuota(source),
      cuotasTotales: source.cuotasTotales,
      mes,
      anio,
      notas: source.notas,
      confirmado: false,
      categoriaId: source.categoriaId,
      etiquetas: { connect: (source.etiquetas ?? []).map((c: any) => ({ id: c.id })) },
      esTarjeta: source.esTarjeta,
    },
  })

  await Promise.all(candidatos.map(i => prisma.gastoItem.create({ data: itemCreateData(i, nuevo.id) })))

  return { status: 'created', gasto_id: nuevo.id, added_items: candidatos.length }
}
