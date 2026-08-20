import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { toGastoResponse } from '@/lib/gastos-compute'
import { parsePeriodoBody, shiftFechaAPeriodo } from '@/lib/mover-periodo'

const INCLUDE = {
  casa: true,
  moneda: true,
  tarjeta: { include: { cierres: true } },
  concepto: true,
  categoria: true,
  etiquetas: true,
  pagos: { orderBy: { createdAt: 'asc' as const } },
  items: { orderBy: { createdAt: 'asc' as const }, include: { concepto: true, categoria: true, etiquetas: true } },
}

/**
 * `PATCH /api/gastos/[id]/periodo` — reimputa un gasto a otro `(mes, anio)`.
 *
 * Body: `{ mes, anio, mover_fecha?: boolean }`. Con `mover_fecha` la `fechaVencimiento` se
 * reubica en el período nuevo conservando el día (recortado al último si no existe allá).
 *
 * Es un endpoint aparte y no un `PUT` completo a propósito: mover de mes no debe poder
 * pisar montos, concepto ni clasificación por un body incompleto. Los pagos y sub-items
 * viajan con el gasto sin tocarse — son sus hijos, no dependen del período.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  }

  const periodo = parsePeriodoBody(await req.json())
  if (!periodo) {
    return NextResponse.json({ error: 'mes (1-12) y anio son requeridos' }, { status: 400 })
  }

  const actual = await prisma.gasto.findUnique({ where: { id }, select: { fechaVencimiento: true } })
  if (!actual) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const data: { mes: number; anio: number; fechaVencimiento?: string } = {
    mes: periodo.mes,
    anio: periodo.anio,
  }
  if (periodo.moverFecha) {
    const nueva = shiftFechaAPeriodo(actual.fechaVencimiento, periodo.mes, periodo.anio)
    // Si la fecha guardada no parsea, se mueve el período igual y se deja la fecha como está:
    // es preferible a fallar el movimiento entero por un dato viejo mal formado.
    if (nueva) data.fechaVencimiento = nueva
  }

  const gasto = await prisma.gasto.update({ where: { id }, data, include: INCLUDE })
  return NextResponse.json(toGastoResponse(gasto))
}
