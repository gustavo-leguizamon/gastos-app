import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { computeResumen } from '@/lib/resumen-compute'
import { buildIngresosWhere } from '@/lib/ingresos-compute'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mes = searchParams.get('mes')
  const anio = searchParams.get('anio')
  const casa_id = searchParams.get('casa_id')
  const todayParam = searchParams.get('today')
  const d = new Date()
  const today = todayParam ?? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const where: any = {}
  if (mes) where.mes = Number(mes)
  if (anio) where.anio = Number(anio)

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  })
  const mesesAtras = settings.estimMesesAtras

  // Filtrando por casa, el estimado necesita también los resúmenes de tarjeta de las demás casas:
  // pueden tener consumos de ésta, y cada sub-item cuenta para la casa de su gasto de origen.
  const casaNum = casa_id ? Number(casa_id) : null
  const conResumenes = (w: any) => (casaNum == null ? w : { ...w, OR: [{ casaId: casaNum }, { esTarjeta: true }] })
  // Casa de origen del sub-item propagado: el gasto con crédito del pago que lo generó.
  const origen = { pago: { select: { gasto: { select: { casaId: true } } } } }
  const mesNum = mes ? Number(mes) : new Date().getMonth() + 1
  const anioNum = anio ? Number(anio) : new Date().getFullYear()

  // Genera la lista de {mes, anio} para los `mesesAtras` meses previos
  const prevMonths: { mes: number; anio: number }[] = []
  let pm = mesNum
  let pa = anioNum
  for (let i = 0; i < mesesAtras; i++) {
    if (pm === 1) { pm = 12; pa -= 1 } else { pm -= 1 }
    prevMonths.push({ mes: pm, anio: pa })
  }

  const [ingresos, gastosEstim, ...prevGastos] = await Promise.all([
    prisma.ingreso.findMany({ where: buildIngresosWhere(mes, anio, casa_id), select: { montoMoneda: true, tipoCambio: true } }),
    // El concepto (del gasto y de cada sub-item) sólo hace falta para rotular el detalle del estimado.
    prisma.gasto.findMany({
      where: conResumenes(where),
      include: {
        pagos: true,
        concepto: { select: { nombre: true } },
        items: { include: { concepto: { select: { nombre: true } }, ...origen } },
      },
    }),
    ...prevMonths.map(p => prisma.gasto.findMany({
      where: conResumenes({ mes: p.mes, anio: p.anio }),
      include: { items: { include: origen } },
    })),
  ])

  // Los totales del resumen siguen siendo sólo los gastos de la casa.
  const gastos = casaNum == null ? gastosEstim : gastosEstim.filter(g => g.casaId === casaNum)
  const resumen = computeResumen(gastos, prevGastos, settings, today, ingresos, prevMonths, {
    actual: gastosEstim,
    casaId: casaNum,
  })
  return NextResponse.json(resumen)
}
