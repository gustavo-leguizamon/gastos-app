import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { mesesPrevios } from '@/lib/fechas'
import { gastadoPorCategoria, type BasePresupuesto } from '@/lib/presupuestos-base'
import {
  parseGenerarBody,
  promediosPorCategoria,
  distribuirPresupuestos,
  type Propuesta,
} from '@/lib/presupuestos-auto'

/** Lo que necesita la agregación de las dos bases (ver `presupuestos-base.ts`). */
const GASTO_INCLUDE = {
  categoria: true,
  etiquetas: true,
  concepto: true,
  tarjeta: true,
  casa: true,
  items: { include: { categoria: true, etiquetas: true, concepto: true } },
}

/**
 * `POST /api/presupuestos/generar` — propuesta de topes a partir de un objetivo de ahorro.
 *
 * **No persiste nada.** El wizard ajusta los montos a mano antes de aplicar, y escribir en
 * cada tecla sería un viaje a la DB por pulsación; además una propuesta que todavía no se
 * confirmó no debería pisar los topes que ya están cargados.
 *
 * Devuelve **las dos bases** (`devengado` y `caja`): el reparto sale del promedio histórico,
 * y ese promedio es distinto según qué se cuente como gastado, así que las dos propuestas se
 * muestran lado a lado y el usuario elige cuál aplicar.
 *
 * La ventana promediada son los meses **anteriores** al del presupuesto: al presupuestar un
 * mes que todavía no arrancó, sus propios gastos no dicen nada.
 */
export async function POST(req: NextRequest) {
  const parsed = parseGenerarBody(await req.json())
  if (!parsed) {
    return NextResponse.json(
      { error: 'mes (1-12), anio, objetivo (>= 0) e ingresos_esperados (>= 0) son requeridos' },
      { status: 400 },
    )
  }
  const { mes, anio, objetivo, ingresosEsperados, mesesHistorico, fijadas } = parsed

  const ventana = mesesPrevios(mes, anio, mesesHistorico)
  const gastos = await prisma.gasto.findMany({
    where: { OR: ventana.map(m => ({ mes: m.mes, anio: m.anio })) },
    include: GASTO_INCLUDE,
  })

  const propuestas = {} as Record<BasePresupuesto, Propuesta>
  for (const base of ['devengado', 'caja'] as const) {
    // Un `por_categoria` por mes: el promedio necesita saber en cuántos meses hubo gasto,
    // que es lo que se pierde si se agrega toda la ventana de una.
    const porMes = ventana.map(m =>
      gastadoPorCategoria(
        gastos.filter(g => g.mes === m.mes && g.anio === m.anio),
        base,
        [m],
      ).por_categoria,
    )
    propuestas[base] = distribuirPresupuestos({
      objetivo,
      ingresos: ingresosEsperados,
      promedios: promediosPorCategoria(porMes),
      fijadas,
    })
  }

  return NextResponse.json({
    mes,
    anio,
    objetivo,
    ingresos_esperados: ingresosEsperados,
    meses_historico: mesesHistorico,
    ventana,
    propuestas,
  })
}
