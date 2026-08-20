import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { shiftMonth } from '@/lib/fechas'

/**
 * `POST /api/presupuestos/copiar` — copia los topes del mes anterior al período `{ mes, anio }`.
 *
 * Sin esto, arrancar cada mes significaría re-tipear todos los presupuestos, que en la
 * práctica se repiten. **No pisa lo ya cargado**: las categorías que ya tienen tope en el
 * destino se saltean, así copiar dos veces no borra un ajuste hecho a mano.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const mes = Number(body?.mes)
  const anio = Number(body?.anio)

  if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio)) {
    return NextResponse.json({ error: 'mes (1-12) y anio son requeridos' }, { status: 400 })
  }

  const origen = shiftMonth(mes, anio, -1)

  const [previos, actuales] = await Promise.all([
    prisma.presupuesto.findMany({ where: { mes: origen.mes, anio: origen.anio } }),
    prisma.presupuesto.findMany({ where: { mes, anio }, select: { categoriaId: true } }),
  ])

  if (previos.length === 0) {
    return NextResponse.json(
      { error: `No hay presupuestos cargados en ${origen.mes}/${origen.anio}.` },
      { status: 409 },
    )
  }

  const yaCargadas = new Set(actuales.map(p => p.categoriaId))
  const aCrear = previos.filter(p => !yaCargadas.has(p.categoriaId))

  if (aCrear.length > 0) {
    await prisma.presupuesto.createMany({
      data: aCrear.map(p => ({ categoriaId: p.categoriaId, mes, anio, monto: p.monto })),
    })
  }

  return NextResponse.json({
    ok: true,
    origen,
    copiados: aCrear.length,
    // Los que ya estaban y por eso no se tocaron — para poder decirlo en el toast.
    omitidos: previos.length - aCrear.length,
  })
}
