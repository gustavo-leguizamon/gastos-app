import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { toConceptoDefaults, ULTIMO_USO_ORDER_BY } from '@/lib/concepto-defaults'

// GET /api/conceptos/[id]/ultimo-uso — defaults con los que el alta de un gasto se prefillea al
// elegir un concepto ya usado (categoría, etiquetas, medio de pago, monto, etc.), tomados del
// último gasto de ese concepto. Devuelve `null` si el concepto no tiene histórico (concepto nuevo).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
  }

  const ultimo = await prisma.gasto.findFirst({
    // Los resúmenes de tarjeta no son un gasto "cargable" a mano: su descripción se sincroniza
    // con la tarjeta y heredarlos como default llevaría a duplicar resúmenes.
    where: { conceptoId: id, esTarjeta: false },
    orderBy: ULTIMO_USO_ORDER_BY,
    select: {
      casaId: true,
      tipoPago: true,
      monedaId: true,
      tipoCambio: true,
      tarjetaId: true,
      categoriaId: true,
      totalMoneda: true,
      mes: true,
      anio: true,
      etiquetas: { select: { id: true } },
    },
  })

  return NextResponse.json(toConceptoDefaults(ultimo))
}
