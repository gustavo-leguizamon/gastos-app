import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// Genera la ventana de `count` meses que termina en (mes, anio) inclusive, ordenada cronológicamente.
function buildWindow(mes: number, anio: number, count: number) {
  const months: { mes: number; anio: number }[] = []
  let m = mes
  let y = anio
  for (let i = 0; i < count; i++) {
    months.unshift({ mes: m, anio: y })
    m--
    if (m < 1) { m = 12; y-- }
  }
  return months
}

// Total ARS del gasto, replicando la lógica de la grilla: si no está confirmado y tiene
// sub-items, usa la suma de los items incluidos en total; sino, totalMoneda × tipoCambio.
function gastoTotalArs(g: any) {
  if (!g.confirmado && g.items?.length) {
    return g.items.filter((i: any) => i.incluyeEnTotal).reduce((s: number, i: any) => s + i.monto, 0)
  }
  return g.totalMoneda * g.tipoCambio
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const descripcion = searchParams.get('descripcion')
  const casa_id = searchParams.get('casa_id')
  const mes = Number(searchParams.get('mes'))
  const anio = Number(searchParams.get('anio'))
  const mesesParam = Number(searchParams.get('meses'))

  if (!descripcion || !mes || !anio) {
    return NextResponse.json({ error: 'Faltan parámetros: descripcion, mes, anio' }, { status: 400 })
  }

  // Cantidad de meses a mostrar (incluye el mes actual). Default 6, acotado a 2–24.
  const count = Number.isFinite(mesesParam) && mesesParam > 0 ? Math.min(24, Math.max(2, Math.round(mesesParam))) : 6
  const months = buildWindow(mes, anio, count)

  const where: any = {
    descripcion: { equals: descripcion, mode: 'insensitive' },
    OR: months.map(({ mes, anio }) => ({ mes, anio })),
  }
  if (casa_id) where.casaId = Number(casa_id)

  const gastos = await prisma.gasto.findMany({
    where,
    include: { items: true },
  })

  // Agrega total_ars por (anio, mes).
  const map = new Map<string, number>()
  for (const g of gastos) {
    const key = `${g.anio}-${g.mes}`
    map.set(key, (map.get(key) ?? 0) + gastoTotalArs(g))
  }

  const data = months.map(({ mes, anio }) => {
    const key = `${anio}-${mes}`
    return {
      mes,
      anio,
      label: `${MESES_CORTOS[mes - 1]} ${String(anio).slice(2)}`,
      total_ars: Math.round((map.get(key) ?? 0) * 100) / 100,
    }
  })

  return NextResponse.json(data)
}
