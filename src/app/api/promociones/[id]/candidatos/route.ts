import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { medioCoincide } from '@/lib/promociones-compute'

/**
 * `GET /api/promociones/[id]/candidatos?mes=&anio=` — los gastos del mes que **podrían** contar
 * para la promo, para asociarlos de una vez (ej. el primer mes, con gastos cargados antes de
 * que existiera la promo).
 *
 * Candidato = gasto no-resumen del concepto vinculado cuyo medio de pago entra en la promo, más
 * los que ya están asociados (aunque hoy no coincidan, para poder desasociarlos). 400 si la
 * promo no tiene concepto vinculado: sin él no hay criterio para listar.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  const { searchParams } = new URL(req.url)
  const mes = Number(searchParams.get('mes'))
  const anio = Number(searchParams.get('anio'))
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio)) {
    return NextResponse.json({ error: 'mes (1-12) y anio son requeridos' }, { status: 400 })
  }

  const promo = await prisma.promocion.findUnique({ where: { id }, include: { tarjetas: true } })
  if (!promo) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  if (promo.conceptoId == null) {
    return NextResponse.json({ error: 'La promoción no tiene un concepto vinculado' }, { status: 400 })
  }

  const gastos = await prisma.gasto.findMany({
    where: { mes, anio, esTarjeta: false, OR: [{ conceptoId: promo.conceptoId }, { promocionId: id }] },
    include: { concepto: true, tarjeta: true },
    orderBy: [{ fechaVencimiento: 'asc' }, { id: 'asc' }],
  })

  const medios = { tarjetaIds: promo.tarjetas.map(t => t.id), efectivo: promo.efectivo }
  const items = gastos
    .filter(g => g.promocionId === id || (g.conceptoId === promo.conceptoId && medioCoincide(medios, g)))
    .map(g => ({
      id: g.id,
      descripcion: g.concepto?.nombre ?? '',
      fecha_vencimiento: g.fechaVencimiento,
      tipo_pago: g.tipoPago,
      tarjeta_nombre: g.tarjeta?.nombre ?? null,
      total_ars: Math.round(g.totalMoneda * g.tipoCambio * 100) / 100,
      asociado: g.promocionId === id,
      /** Ya cuenta para *otra* promo: asociarlo acá se lo saca a esa. */
      asociado_a_otra: g.promocionId != null && g.promocionId !== id,
    }))

  return NextResponse.json(items)
}
