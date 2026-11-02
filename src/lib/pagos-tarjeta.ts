import { prisma } from '@/lib/db'
import { resolvePeriodoTarjetaByCierres } from '@/lib/fechas'
import { resolveConcepto } from '@/lib/conceptos'

export type PeriodoTarjeta = { mes: number; anio: number }

/**
 * Período del resumen de la tarjeta al que cae un pago, según las fechas de cierre
 * completas cargadas. `null` si la tarjeta no tiene ninguna fecha de cierre.
 */
export async function resolveTargetPeriodo(tarjetaId: number, fecha: string): Promise<PeriodoTarjeta | null> {
  const cierres = await prisma.tarjetaCierre.findMany({
    where: { tarjetaId, fechaCierre: { not: null } },
    select: { mes: true, anio: true, fechaCierre: true },
  })
  return resolvePeriodoTarjetaByCierres(fecha, cierres)
}

/** Busca el resumen de la tarjeta del período; si no existe, lo crea con defaults. */
export async function findOrCreateResumen(source: any, target: PeriodoTarjeta) {
  const found = await prisma.gasto.findFirst({
    where: { esTarjeta: true, tarjetaId: source.tarjetaId, mes: target.mes, anio: target.anio },
  })
  if (found) return found

  const tarjeta = await prisma.tarjeta.findUnique({ where: { id: source.tarjetaId } })
  if (!tarjeta) return null
  const ars = await prisma.moneda.findFirst({ where: { codigo: 'ARS' } })
  if (!ars) return null

  // Si existe un TarjetaCierre del target con fechaVencimiento, usamos ese; sino default al día 1.
  const targetCierre = await prisma.tarjetaCierre.findUnique({
    where: { tarjetaId_mes_anio: { tarjetaId: source.tarjetaId, mes: target.mes, anio: target.anio } },
  })
  const defaultVenc = targetCierre?.fechaVencimiento || `${target.anio}-${String(target.mes).padStart(2, '0')}-01`
  const conceptoId = await resolveConcepto(
    prisma,
    tarjeta.banco ? `${tarjeta.nombre} (${tarjeta.banco})` : tarjeta.nombre,
  )
  return prisma.gasto.create({
    data: {
      casaId: source.casaId,
      conceptoId,
      fechaVencimiento: defaultVenc,
      tipoPago: 'D',
      monedaId: ars.id,
      tipoCambio: 1,
      totalMoneda: 0,
      totalPagado: 0,
      pasajeMesSiguiente: 0,
      tarjetaId: source.tarjetaId,
      mes: target.mes,
      anio: target.anio,
      confirmado: false,
      esTarjeta: true,
    },
  })
}

/** Crea el sub-item del pago en el resumen de la tarjeta del período destino. */
export async function propagatePagoToTarjeta(opts: {
  source: any
  target: PeriodoTarjeta
  fecha: string
  monto: number
  pagoId: number
}) {
  const { source, target } = opts
  const targetCC = await findOrCreateResumen(source, target)
  if (!targetCC) return

  await prisma.gastoItem.create({
    data: {
      gastoId: targetCC.id,
      conceptoId: source.conceptoId,
      monto: opts.monto,
      fecha: opts.fecha,
      incluyeEnTotal: true,
      incluyeEnVencimiento: false,
      pagoId: opts.pagoId,
      categoriaId: source.categoriaId ?? null,
      etiquetas: { connect: (source.etiquetas ?? []).map((c: any) => ({ id: c.id })) },
      cuotaActual: source.cuotaActual ?? null,
      cuotasTotales: source.cuotasTotales ?? null,
    },
  })
}
