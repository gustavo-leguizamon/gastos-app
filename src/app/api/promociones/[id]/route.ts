import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parsePromocionBody, toPromocionResponse } from '@/lib/promociones-compute'
import { validarReferenciasPromocion } from '@/lib/promociones-refs'

/**
 * `PUT /api/promociones/[id]` — edita una promoción. Las tarjetas se **reemplazan** (`set`):
 * el body trae la lista completa, no un diff.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  }
  const data = parsePromocionBody(await req.json())
  if (!data) return NextResponse.json({ error: 'Datos de la promoción inválidos' }, { status: 400 })

  const existe = await prisma.promocion.findUnique({ where: { id } })
  if (!existe) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const error = await validarReferenciasPromocion(data)
  if (error) return NextResponse.json({ error }, { status: 400 })

  const actualizada = await prisma.promocion.update({
    where: { id },
    data: {
      lugar: data.lugar,
      conceptoId: data.conceptoId,
      porcentaje: data.porcentaje,
      topeMensual: data.topeMensual,
      dias: data.dias,
      efectivo: data.efectivo,
      activa: data.activa,
      notas: data.notas,
      vigenteDesde: data.vigenteDesde,
      vigenteHasta: data.vigenteHasta,
      tarjetas: { set: data.tarjetaIds.map(t => ({ id: t })) },
    },
    include: { concepto: true, tarjetas: true },
  })
  return NextResponse.json(toPromocionResponse(actualizada))
}

/** `DELETE /api/promociones/[id]` — borra la promo y sus usos manuales (cascade). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  }
  const existe = await prisma.promocion.findUnique({ where: { id } })
  if (!existe) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  await prisma.promocion.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
