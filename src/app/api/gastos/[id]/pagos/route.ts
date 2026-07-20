import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { resolvePeriodoTarjetaByCierres } from '@/lib/fechas'
import { resolveConcepto } from '@/lib/conceptos'

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

async function propagatePagoToTarjeta(opts: {
  source: any
  target: { mes: number; anio: number }
  fecha: string
  monto: number
  pagoId: number
}) {
  const { source, target } = opts

  // Buscar el target CC gasto
  let targetCC = await prisma.gasto.findFirst({
    where: {
      esTarjeta: true,
      tarjetaId: source.tarjetaId,
      mes: target.mes,
      anio: target.anio,
    },
  })

  if (!targetCC) {
    // Buscar la tarjeta para usar su nombre como descripción
    const tarjeta = await prisma.tarjeta.findUnique({ where: { id: source.tarjetaId } })
    if (!tarjeta) return

    // Moneda ARS (default)
    const ars = await prisma.moneda.findFirst({ where: { codigo: 'ARS' } })
    if (!ars) return

    // Si existe un TarjetaCierre del target con fechaVencimiento, usamos ese; sino default al día 1.
    const targetCierre = await prisma.tarjetaCierre.findUnique({
      where: {
        tarjetaId_mes_anio: { tarjetaId: source.tarjetaId, mes: target.mes, anio: target.anio },
      },
    })
    const defaultVenc = targetCierre?.fechaVencimiento || `${target.anio}-${String(target.mes).padStart(2, '0')}-01`
    const tarjetaConceptoId = await resolveConcepto(
      prisma,
      tarjeta.banco ? `${tarjeta.nombre} (${tarjeta.banco})` : tarjeta.nombre,
    )
    targetCC = await prisma.gasto.create({
      data: {
        casaId: source.casaId,
        conceptoId: tarjetaConceptoId,
        fechaVencimiento: defaultVenc,
        tipoPago: 'D',
        monedaId: ars.id,
        tipoCambio: 1,
        totalMoneda: 0,
        totalPagado: 0,
        pasajeMesSiguiente: 0,
        prestamo_a_otro: 0,
        tarjetaId: source.tarjetaId,
        mes: target.mes,
        anio: target.anio,
        confirmado: false,
        esTarjeta: true,
      },
    })
  }

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
    const cierres = await prisma.tarjetaCierre.findMany({
      where: { tarjetaId: source.tarjetaId!, fechaCierre: { not: null } },
      select: { mes: true, anio: true, fechaCierre: true },
    })
    target = resolvePeriodoTarjetaByCierres(body.fecha, cierres)
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
