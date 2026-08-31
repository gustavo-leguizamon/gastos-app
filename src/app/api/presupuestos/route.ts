import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { mesesPrevios } from '@/lib/fechas'
import { sumIngresos } from '@/lib/ingresos-compute'
import { gastadoPorCategoria } from '@/lib/presupuestos-base'
import { toObjetivoResponse, MESES_HISTORICO_DEFAULT } from '@/lib/presupuestos-auto'
import {
  parsePresupuestoBody,
  toPresupuestoResponse,
  computeEjecucion,
  totalesPresupuesto,
} from '@/lib/presupuestos-compute'

/**
 * `GET /api/presupuestos?mes=&anio=` — topes del período **junto con su ejecución**.
 *
 * Devuelve los topes junto con su ejecución en una sola llamada porque separarlas obligaría
 * al cliente a cruzar topes contra gastos por su cuenta, que es justamente el cálculo que no
 * debe estar duplicado.
 *
 * La ejecución viene **en las dos bases** (ver `presupuestos-base.ts`), porque miden cosas
 * distintas y las dos importan: `ejecucion`/`totales` es devengado (lo consumido, la métrica
 * del reporte por categoría) y `ejecucion_caja`/`totales_caja` es caja (la plata que salió de
 * la cuenta, la que mide el ahorro del mes). Los topes son los mismos en las dos: lo que
 * cambia es contra qué se comparan.
 *
 * Por eso la query trae **todos** los gastos del mes en vez de filtrar `esTarjeta` en el
 * `where`: cada base se queda con el subconjunto que le corresponde, y no hacen falta dos
 * viajes a la DB para lo mismo.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mes = Number(searchParams.get('mes'))
  const anio = Number(searchParams.get('anio'))

  if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio)) {
    return NextResponse.json({ error: 'mes (1-12) y anio son requeridos' }, { status: 400 })
  }

  // Ventana de referencia para sugerir los ingresos del mes cuando todavía no hay ninguno
  // cargado — el caso normal al presupuestar un mes que no arrancó.
  const ventana = mesesPrevios(mes, anio, MESES_HISTORICO_DEFAULT)

  const [presupuestos, gastos, objetivo, ingresosMes, ingresosVentana] = await Promise.all([
    prisma.presupuesto.findMany({
      where: { mes, anio },
      include: { categoria: true },
      orderBy: { categoria: { nombre: 'asc' } },
    }),
    prisma.gasto.findMany({
      where: { mes, anio },
      include: {
        categoria: true,
        etiquetas: true,
        concepto: true,
        tarjeta: true,
        casa: true,
        // Con sus relaciones: la base caja desglosa el resumen de tarjeta por sub-ítem y
        // necesita la categoría de cada uno para saber en qué se gastó.
        items: { include: { categoria: true, etiquetas: true, concepto: true } },
      },
    }),
    prisma.objetivoAhorro.findUnique({ where: { mes_anio: { mes, anio } } }),
    prisma.ingreso.findMany({ where: { mes, anio }, select: { montoMoneda: true, tipoCambio: true } }),
    prisma.ingreso.findMany({
      where: { OR: ventana.map(m => ({ mes: m.mes, anio: m.anio })) },
      select: { montoMoneda: true, tipoCambio: true },
    }),
  ])

  const meses = [{ mes, anio }]
  const filas = presupuestos.map(toPresupuestoResponse)
  const topes = filas.map(p => ({
    categoria_id: p.categoria_id,
    categoria_nombre: p.categoria_nombre,
    monto: p.monto,
  }))

  // Prefill del wizard: los ingresos ya cargados del mes si los hay; si no, el promedio de
  // la ventana. Es una sugerencia editable — nunca se persiste sin que el usuario la vea.
  const totalIngresosMes = sumIngresos(ingresosMes)
  const ingresosSugeridos = totalIngresosMes > 0
    ? totalIngresosMes
    : Math.round((sumIngresos(ingresosVentana) / Math.max(1, ventana.length)) * 100) / 100

  const devengado = gastadoPorCategoria(gastos, 'devengado', meses)
  const caja = gastadoPorCategoria(gastos, 'caja', meses)
  const ejecucion = computeEjecucion(topes, devengado.por_categoria)
  const ejecucionCaja = computeEjecucion(topes, caja.por_categoria)

  return NextResponse.json({
    mes,
    anio,
    presupuestos: filas,
    ejecucion,
    totales: totalesPresupuesto(ejecucion),
    ejecucion_caja: ejecucionCaja,
    totales_caja: totalesPresupuesto(ejecucionCaja),
    // Débito del mes que ninguna categoría se llevó (sub-ítems que no cierran contra el
    // total del resumen). Se informa para que la comparación no parezca completa cuando no
    // lo está — ver `presupuestos-base.ts`.
    no_atribuido_caja: caja.no_atribuido,
    // Objetivo de ahorro del período, si se generó alguno. `null` = los topes se cargaron a
    // mano y no hay meta contra la cual medirlos.
    objetivo: objetivo ? toObjetivoResponse(objetivo) : null,
    ingresos_mes: totalIngresosMes,
    ingresos_sugeridos: ingresosSugeridos,
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
