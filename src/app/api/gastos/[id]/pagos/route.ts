import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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

// Avanza un (mes, anio) por n meses
function shiftMonth(mes: number, anio: number, n: number) {
  const m0 = mes - 1 + n
  return { mes: ((m0 % 12) + 12) % 12 + 1, anio: anio + Math.floor(m0 / 12) }
}

async function propagatePagoToTarjeta(opts: {
  sourceGastoId: number
  fecha: string
  monto: number
  pagoId: number
}) {
  const source = await prisma.gasto.findUnique({ where: { id: opts.sourceGastoId } })
  if (!source) return
  if (source.tipoPago !== 'C') return
  if (!source.tarjetaId) return

  // CC gasto del mes/año del source para esa tarjeta
  const currentCC = await prisma.gasto.findFirst({
    where: {
      esTarjeta: true,
      tarjetaId: source.tarjetaId,
      mes: source.mes,
      anio: source.anio,
    },
  })

  // Si payment.fecha <= fechaProximoCierre → target = source +1 ; else → +2
  // Si no hay fechaProximoCierre, default = +1.
  const proximo = currentCC?.fechaProximoCierre ?? null
  const shift = proximo && opts.fecha > proximo ? 2 : 1
  const target = shiftMonth(source.mes, source.anio, shift)

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

    const defaultVenc = `${target.anio}-${String(target.mes).padStart(2, '0')}-01`
    targetCC = await prisma.gasto.create({
      data: {
        casaId: source.casaId,
        descripcion: tarjeta.banco ? `${tarjeta.nombre} (${tarjeta.banco})` : tarjeta.nombre,
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
      descripcion: source.descripcion,
      monto: opts.monto,
      fecha: opts.fecha,
      incluyeEnTotal: true,
      incluyeEnVencimiento: false,
      pagoId: opts.pagoId,
      categoriaId: source.categoriaId ?? null,
    },
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const pago = await prisma.pago.create({
    data: {
      gastoId: Number(params.id),
      fecha: body.fecha,
      monto: body.monto,
    },
  })

  // Propagar a la tarjeta de crédito (si aplica)
  try {
    await propagatePagoToTarjeta({
      sourceGastoId: Number(params.id),
      fecha: pago.fecha,
      monto: pago.monto,
      pagoId: pago.id,
    })
  } catch (err) {
    // No interrumpir el flujo del pago aunque falle la propagación
    console.error('Propagación de pago a tarjeta falló:', err)
  }

  return NextResponse.json({
    id: pago.id,
    gasto_id: pago.gastoId,
    fecha: pago.fecha,
    monto: pago.monto,
    created_at: pago.createdAt.toISOString(),
  }, { status: 201 })
}
