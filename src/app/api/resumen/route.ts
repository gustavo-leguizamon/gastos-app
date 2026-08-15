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
  if (casa_id) where.casaId = Number(casa_id)

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  })
  const mesesAtras = settings.estimMesesAtras

  const baseWhere: any = {}
  if (casa_id) baseWhere.casaId = Number(casa_id)
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

  const [ingresos, gastos, ...prevGastos] = await Promise.all([
    prisma.ingreso.findMany({ where: buildIngresosWhere(mes, anio, casa_id), select: { montoMoneda: true, tipoCambio: true } }),
    prisma.gasto.findMany({ where, include: { pagos: true, items: true } }),
    ...prevMonths.map(p => prisma.gasto.findMany({ where: { ...baseWhere, mes: p.mes, anio: p.anio }, include: { items: true } })),
  ])

  const resumen = computeResumen(gastos, prevGastos, settings, today, ingresos)
  return NextResponse.json(resumen)
}
