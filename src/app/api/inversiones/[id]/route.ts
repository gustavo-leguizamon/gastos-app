import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { toInversionResponse, parseMonedaId } from '@/lib/inversiones-compute'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  }

  const body = await req.json()
  const nombre = String(body?.nombre ?? '').trim()
  if (!nombre) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

  // `moneda_id` sólo se toca si viene en el body: un PUT que sólo renombra no debería
  // borrar la moneda por omisión.
  const data: { nombre: string; monedaId?: number | null } = { nombre }
  if ('moneda_id' in (body ?? {})) data.monedaId = parseMonedaId(body.moneda_id)

  const inversion = await prisma.inversion.update({
    where: { id },
    data,
    include: { moneda: true },
  })
  return NextResponse.json(toInversionResponse(inversion))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.inversion.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
