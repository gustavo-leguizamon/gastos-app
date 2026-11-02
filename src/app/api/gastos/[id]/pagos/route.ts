import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { propagatePagoToTarjeta, resolveTargetPeriodo } from '@/lib/pagos-tarjeta'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const pagos = await prisma.pago.findMany({
    where: { gastoId: Number(params.id) },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(pagos.map(p => ({
    id: p.id,
    gasto_id: p.gastoId,
    fecha: p.fecha,
    monto: p.monto,
    created_at: p.createdAt.toISOString(),
  })))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const gastoId = Number(params.id)

  // Si el gasto es de tarjeta de crédito, el pago debe impactar en el resumen de la
  // tarjeta. El período destino se calcula de forma absoluta a partir de la fecha del
  // pago y las fechas de cierre COMPLETAS de la tarjeta (no del mes/año en que esté
  // clasificado el gasto fuente): el pago pertenece al resumen cuyo `fechaCierre` es el
  // primero en ocurrir en/después de la fecha del pago.
  const source = await prisma.gasto.findUnique({ where: { id: gastoId }, include: { etiquetas: true } })
  const esCredito = source?.tipoPago === 'C' && !!source?.tarjetaId

  let target: { mes: number; anio: number } | null = null
  if (esCredito && source) {
    target = await resolveTargetPeriodo(source.tarjetaId!, body.fecha)
    if (target == null) {
      return NextResponse.json(
        { error: 'No se puede registrar el pago: la tarjeta no tiene fechas de cierre configuradas. Configurá el cierre en Configuración → Tarjetas.' },
        { status: 400 },
      )
    }
  }

  const pago = await prisma.pago.create({
    data: {
      gastoId,
      fecha: body.fecha,
      monto: body.monto,
    },
  })

  // Propagar a la tarjeta de crédito (si aplica)
  if (esCredito && source && target) {
    try {
      await propagatePagoToTarjeta({
        source,
        target,
        fecha: pago.fecha,
        monto: pago.monto,
        pagoId: pago.id,
      })
    } catch (err) {
      // No interrumpir el flujo del pago aunque falle la propagación
      console.error('Propagación de pago a tarjeta falló:', err)
    }
  }

  return NextResponse.json({
    id: pago.id,
    gasto_id: pago.gastoId,
    fecha: pago.fecha,
    monto: pago.monto,
    created_at: pago.createdAt.toISOString(),
  }, { status: 201 })
}
