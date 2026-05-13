import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mes = searchParams.get('mes')
  const anio = searchParams.get('anio')
  const casa_id = searchParams.get('casa_id')
  const today = new Date().toISOString().split('T')[0]

  const where: any = {}
  if (mes) where.mes = Number(mes)
  if (anio) where.anio = Number(anio)
  if (casa_id) where.casaId = Number(casa_id)

  const gastos = await prisma.gasto.findMany({ where, include: { pagos: true } })

  let total_gastos = 0
  let total_pagado = 0
  let total_restante = 0
  let pagar_hoy = 0

  for (const g of gastos) {
    const totalArs = g.totalMoneda * g.tipoCambio
    const pagado = g.pagos.reduce((s, p) => s + p.monto, 0)
    const restante = totalArs - pagado
    total_gastos += totalArs
    total_pagado += pagado
    total_restante += restante
    if (g.fechaVencimiento === today) pagar_hoy += restante
  }

  return NextResponse.json({
    total_gastos: Math.round(total_gastos * 100) / 100,
    total_restante: Math.round(total_restante * 100) / 100,
    total_pagado: Math.round(total_pagado * 100) / 100,
    pagar_hoy: Math.round(pagar_hoy * 100) / 100,
  })
}
