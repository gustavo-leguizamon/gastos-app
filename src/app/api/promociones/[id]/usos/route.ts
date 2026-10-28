import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseUsoBody, toUsoResponse } from '@/lib/promociones-compute'

/**
 * `POST /api/promociones/[id]/usos` — registra un consumo con promo a mano
 * (`{ fecha, monto_gasto, notas? }`). `mes`/`anio` se derivan de la fecha.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const promocionId = Number(params.id)
  if (!Number.isInteger(promocionId) || promocionId <= 0) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  }
  const data = parseUsoBody(await req.json())
  if (!data) return NextResponse.json({ error: 'Datos del uso inválidos' }, { status: 400 })

  const promo = await prisma.promocion.findUnique({ where: { id: promocionId } })
  if (!promo) return NextResponse.json({ error: 'Promoción no encontrada' }, { status: 404 })

  const creado = await prisma.promocionUso.create({ data: { promocionId, ...data } })
  return NextResponse.json(toUsoResponse(creado), { status: 201 })
}
