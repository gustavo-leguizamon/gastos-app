import { NextRequest, NextResponse } from 'next/server'
import { copiarGasto } from '@/lib/copiar-gasto'

// Copia un gasto (+ sub-items) al mes/año destino con merge. La lógica vive en
// `src/lib/copiar-gasto.ts`, compartida con el cron de copia automática de tarjetas.
export async function POST(req: NextRequest) {
  const body = await req.json()
  const sourceId = Number(body.source_id)
  const mes = Number(body.mes)
  const anio = Number(body.anio)

  if (!sourceId || !mes || !anio) {
    return NextResponse.json({ error: 'source_id, mes y anio son requeridos' }, { status: 400 })
  }

  const result = await copiarGasto(sourceId, mes, anio)
  if (result.status === 'not_found') {
    return NextResponse.json({ error: 'Gasto origen no encontrado' }, { status: 404 })
  }
  if (result.status === 'merged') {
    return NextResponse.json({ merged: true, gasto_id: result.gasto_id, added_items: result.added_items })
  }
  return NextResponse.json(
    { created: true, gasto_id: result.gasto_id, added_items: result.added_items },
    { status: 201 },
  )
}
