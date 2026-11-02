import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { findOrCreateResumen, propagatePagoToTarjeta, resolveTargetPeriodo } from '@/lib/pagos-tarjeta'

/**
 * Reimputa un pago de crédito: recalcula el resumen de la tarjeta que le corresponde
 * con las fechas de cierre CARGADAS HOY y mueve el sub-item propagado ahí. Sirve cuando
 * el pago se imputó mal porque el cierre del período todavía no estaba cargado.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string; pagoId: string } }) {
  const gastoId = Number(params.id)
  const pagoId = Number(params.pagoId)
  if (!Number.isInteger(gastoId) || !Number.isInteger(pagoId)) {
    return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
  }

  const pago = await prisma.pago.findUnique({ where: { id: pagoId } })
  if (!pago || pago.gastoId !== gastoId) {
    return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
  }

  const source = await prisma.gasto.findUnique({ where: { id: gastoId }, include: { etiquetas: true } })
  if (!source || source.tipoPago !== 'C' || !source.tarjetaId) {
    return NextResponse.json({ error: 'Sólo se pueden reimputar pagos de gastos con tarjeta de crédito.' }, { status: 400 })
  }

  const target = await resolveTargetPeriodo(source.tarjetaId, pago.fecha)
  if (target == null) {
    return NextResponse.json(
      { error: 'La tarjeta no tiene fechas de cierre configuradas. Configurá el cierre en Configuración → Tarjetas.' },
      { status: 400 },
    )
  }

  const item = await prisma.gastoItem.findFirst({ where: { pagoId }, include: { gasto: true } })

  // Sin sub-item (la propagación había fallado): se crea en el período correcto.
  if (!item) {
    await propagatePagoToTarjeta({ source, target, fecha: pago.fecha, monto: pago.monto, pagoId })
    return NextResponse.json({ moved: true, created: true, mes: target.mes, anio: target.anio })
  }

  if (item.gasto.mes === target.mes && item.gasto.anio === target.anio) {
    return NextResponse.json({ moved: false, mes: target.mes, anio: target.anio })
  }

  const resumen = await findOrCreateResumen(source, target)
  if (!resumen) {
    return NextResponse.json({ error: 'No se pudo resolver el resumen de la tarjeta.' }, { status: 500 })
  }
  // Se mueve el mismo sub-item (conserva lo editado a mano) en vez de borrar y recrear.
  await prisma.gastoItem.update({ where: { id: item.id }, data: { gastoId: resumen.id } })

  return NextResponse.json({ moved: true, created: false, mes: target.mes, anio: target.anio })
}
