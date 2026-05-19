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

  const baseWhere: any = {}
  if (casa_id) baseWhere.casaId = Number(casa_id)
  const mesNum = mes ? Number(mes) : new Date().getMonth() + 1
  const anioNum = anio ? Number(anio) : new Date().getFullYear()
  const m1 = mesNum === 1 ? { mes: 12, anio: anioNum - 1 } : { mes: mesNum - 1, anio: anioNum }
  const m2 = m1.mes === 1 ? { mes: 12, anio: m1.anio - 1 } : { mes: m1.mes - 1, anio: m1.anio }

  const [gastos, m1Gastos, m2Gastos] = await Promise.all([
    prisma.gasto.findMany({ where, include: { pagos: true, items: true } }),
    prisma.gasto.findMany({ where: { ...baseWhere, mes: m1.mes, anio: m1.anio }, include: { items: true } }),
    prisma.gasto.findMany({ where: { ...baseWhere, mes: m2.mes, anio: m2.anio }, include: { items: true } }),
  ])

  let total_gastos = 0
  let total_pagado = 0
  let total_restante = 0
  let pagar_hoy = 0
  let total_prestamos = 0
  let total_tarjetas = 0
  let total_pasajes = 0

  for (const g of gastos) {
    if (!g.confirmado && g.items.length === 0) continue
    const totalArs = g.confirmado
      ? g.totalMoneda * g.tipoCambio
      : g.items.filter((i: any) => i.incluyeEnTotal).reduce((s: number, i: any) => s + i.monto, 0)
    const pagado = g.pagos.reduce((s, p) => s + p.monto, 0)
    const restante = totalArs - pagado
    const prestamo = g.prestamo_a_otro ?? 0
    total_gastos += totalArs
    total_pagado += pagado
    total_restante += restante
    total_prestamos += prestamo
    total_pasajes += g.pasajeMesSiguiente ?? 0
    if (g.tipoPago === 'C' && prestamo === 0) total_tarjetas += totalArs
    if (g.fechaVencimiento === today) {
      pagar_hoy += restante
    } else {
      const itemsHoy = g.items
        .filter((i: any) => i.incluyeEnVencimiento && i.fecha === today)
        .reduce((s: number, i: any) => s + i.monto, 0)
      pagar_hoy += itemsHoy
    }
  }

  // Estimado próximo mes
  type Unit = {
    parentDesc: string
    desc: string
    monto: number
    cuotaActual: number | null
    cuotasTotales: number | null
    isSubitem: boolean
  }
  const norm = (s: string) => s.trim().toLowerCase()
  const buildUnits = (gs: any[]): Unit[] => {
    const out: Unit[] = []
    for (const g of gs) {
      if (!g.confirmado && g.items.length === 0) continue
      const itemsIncl = g.items.filter((i: any) => i.incluyeEnTotal)
      if (itemsIncl.length > 0) {
        // Agrupar sub-items del mismo gasto por descripción normalizada
        const grouped = new Map<string, Unit>()
        for (const it of itemsIncl) {
          const key = norm(it.descripcion)
          const existing = grouped.get(key)
          if (existing) {
            existing.monto += it.monto
            // Si alguno del grupo tiene cuotas, conservamos esa info (tomamos la primera vista)
            if (existing.cuotaActual == null && it.cuotaActual != null) {
              existing.cuotaActual = it.cuotaActual
              existing.cuotasTotales = it.cuotasTotales ?? null
            }
          } else {
            grouped.set(key, {
              parentDesc: norm(g.descripcion),
              desc: key,
              monto: it.monto,
              cuotaActual: it.cuotaActual ?? null,
              cuotasTotales: it.cuotasTotales ?? null,
              isSubitem: true,
            })
          }
        }
        grouped.forEach((u) => out.push(u))
      } else if (g.confirmado) {
        out.push({
          parentDesc: norm(g.descripcion),
          desc: norm(g.descripcion),
          monto: g.totalMoneda * g.tipoCambio,
          cuotaActual: g.cuotaActual ?? null,
          cuotasTotales: g.cuotasTotales ?? null,
          isSubitem: false,
        })
      }
    }
    return out
  }
  const findMatch = (units: Unit[], target: Unit): number => {
    for (const u of units) {
      if (target.isSubitem) {
        if (u.isSubitem && u.parentDesc === target.parentDesc && u.desc === target.desc) return u.monto
      } else {
        if (!u.isSubitem && u.desc === target.desc) return u.monto
      }
    }
    return 0
  }
  const currentUnits = buildUnits(gastos)
  const m1Units = buildUnits(m1Gastos)
  const m2Units = buildUnits(m2Gastos)
  let total_proximo_mes = 0
  for (const u of currentUnits) {
    const tieneCuotas = u.cuotaActual != null && u.cuotasTotales != null
    if (tieneCuotas && (u.cuotaActual as number) >= (u.cuotasTotales as number)) continue
    if (tieneCuotas) {
      total_proximo_mes += u.monto
      continue
    }
    const v1 = findMatch(m1Units, u)
    const v2 = findMatch(m2Units, u)
    total_proximo_mes += (u.monto + v1 + v2) / 3
  }

  const r = (n: number) => Math.round(n * 100) / 100
  return NextResponse.json({
    total_gastos: r(total_gastos),
    total_gastos_neto: r(total_gastos - total_prestamos - total_tarjetas - total_pasajes),
    total_prestamos: r(total_prestamos),
    total_tarjetas: r(total_tarjetas),
    total_pasajes: r(total_pasajes),
    total_restante: r(total_restante),
    total_pagado: r(total_pagado),
    pagar_hoy: r(pagar_hoy),
    total_proximo_mes: r(total_proximo_mes),
  })
}
