import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { computeReportes } from '@/lib/reportes-compute'
import {
  parsePresupuestoBody,
  toPresupuestoResponse,
  computeEjecucion,
  totalesPresupuesto,
} from '@/lib/presupuestos-compute'

/**
 * `GET /api/presupuestos?mes=&anio=` — topes del período **junto con su ejecución**.
 *
 * Devuelve las tres cosas en una sola llamada (`presupuestos`, `ejecucion`, `totales`)
 * porque separarlas obligaría al cliente a cruzar topes contra gastos por su cuenta, que
 * es justamente el cálculo que no debe estar duplicado.
 *
 * Lo gastado sale de `computeReportes` sobre el mes: misma métrica que usa el reporte por
 * categoría, así el panel de presupuesto y el reporte no pueden contradecirse. Eso incluye
 * excluir los resúmenes de tarjeta (`esTarjeta`), que son contenedores de consumos ya
 * contados individualmente — presupuestarlos sería contar dos veces.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mes = Number(searchParams.get('mes'))
  const anio = Number(searchParams.get('anio'))

  if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio)) {
    return NextResponse.json({ error: 'mes (1-12) y anio son requeridos' }, { status: 400 })
  }

  const [presupuestos, gastos] = await Promise.all([
    prisma.presupuesto.findMany({
      where: { mes, anio },
      include: { categoria: true },
      orderBy: { categoria: { nombre: 'asc' } },
    }),
    prisma.gasto.findMany({
      where: { mes, anio, esTarjeta: false },
      include: { categoria: true, etiquetas: true, concepto: true, tarjeta: true, casa: true, items: true },
    }),
  ])

  const reporte = computeReportes(gastos, [{ mes, anio }])
  const filas = presupuestos.map(toPresupuestoResponse)
  const ejecucion = computeEjecucion(
    filas.map(p => ({ categoria_id: p.categoria_id, categoria_nombre: p.categoria_nombre, monto: p.monto })),
    reporte.por_categoria,
  )

  return NextResponse.json({
    mes,
    anio,
    presupuestos: filas,
    ejecucion,
    totales: totalesPresupuesto(ejecucion),
  })
}

/**
 * `POST /api/presupuestos` — fija (o pisa) el tope de una categoría en un período.
 *
 * Es un **upsert** sobre el unique `(categoriaId, mes, anio)`: guardar dos veces la misma
 * categoría actualiza en vez de duplicar, que es lo que necesita un form donde se tipea el
 * monto y se guarda varias veces.
 */
export async function POST(req: NextRequest) {
  const parsed = parsePresupuestoBody(await req.json())
  if (!parsed) {
    return NextResponse.json({ error: 'categoria_id, mes (1-12), anio y monto (>= 0) son requeridos' }, { status: 400 })
  }
  const { categoriaId, mes, anio, monto } = parsed

  const categoria = await prisma.categoria.findUnique({ where: { id: categoriaId } })
  if (!categoria) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })

  const presupuesto = await prisma.presupuesto.upsert({
    where: { categoriaId_mes_anio: { categoriaId, mes, anio } },
    create: { categoriaId, mes, anio, monto },
    update: { monto },
    include: { categoria: true },
  })

  return NextResponse.json(toPresupuestoResponse(presupuesto), { status: 201 })
}
