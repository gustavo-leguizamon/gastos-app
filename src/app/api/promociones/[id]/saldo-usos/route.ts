import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseSaldoUsoBody, toSaldoUsoResponse } from '@/lib/promociones-compute'

/**
 * `POST /api/promociones/[id]/saldo-usos` — registra que se usó parte del **saldo a favor** de la
 * promo (`{ fecha, monto, notas? }`). No valida contra el saldo: el reparto entre reintegros (los
 * que vencen antes primero) y lo que exceda se calculan en `saldoPromocion`.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const promocionId = Number(params.id)
  if (!Number.isInteger(promocionId) || promocionId <= 0) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  }
  const data = parseSaldoUsoBody(await req.json())
  if (!data) return NextResponse.json({ error: 'Datos del uso del saldo inválidos' }, { status: 400 })

  const promo = await prisma.promocion.findUnique({ where: { id: promocionId } })
  if (!promo) return NextResponse.json({ error: 'Promoción no encontrada' }, { status: 404 })

  const creado = await prisma.promocionSaldoUso.create({ data: { promocionId, ...data } })
  return NextResponse.json(toSaldoUsoResponse(creado), { status: 201 })
}
