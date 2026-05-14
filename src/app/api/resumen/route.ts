import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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

  const gastos = await prisma.gasto.findMany({ where, include: { pagos: true, items: true } })

  let total_gastos = 0
  let total_pagado = 0
  let total_restante = 0
  let pagar_hoy = 0
  let total_prestamos = 0
  let total_tarjetas = 0

  for (const g of gastos) {
    const totalArs = g.totalMoneda * g.tipoCambio
    const pagado = g.pagos.reduce((s, p) => s + p.monto, 0)
    const restante = totalArs - pagado
    total_gastos += totalArs
    total_pagado += pagado
    total_restante += restante
    total_prestamos += g.prestamo_a_otro ?? 0
    if (g.tarjetaId) total_tarjetas += totalArs
    if (g.fechaVencimiento === today) {
      pagar_hoy += restante
    } else {
      const itemsHoy = g.items
        .filter((i: any) => i.incluyeEnVencimiento && i.fecha === today)
        .reduce((s: number, i: any) => s + i.monto, 0)
      pagar_hoy += itemsHoy
    }
  }

  const r = (n: number) => Math.round(n * 100) / 100
  return NextResponse.json({
    total_gastos: r(total_gastos),
    total_gastos_neto: r(total_gastos - total_prestamos - total_tarjetas),
    total_prestamos: r(total_prestamos),
    total_tarjetas: r(total_tarjetas),
    total_restante: r(total_restante),
    total_pagado: r(total_pagado),
    pagar_hoy: r(pagar_hoy),
  })
}
