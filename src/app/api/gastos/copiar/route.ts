import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Cuota a usar al copiar un sub-item: si está en cuotas y no finalizaron, +1.
function nextCuota(item: { cuotaActual: number | null; cuotasTotales: number | null }) {
  if (item.cuotaActual != null && item.cuotasTotales != null && item.cuotaActual < item.cuotasTotales) {
    return item.cuotaActual + 1
  }
  return item.cuotaActual
}

// Copia un gasto (+ sub-items) al mes/año destino con merge:
// - Si ya existe un gasto en el destino (mismo concepto + mes + año + casa),
//   no crea uno nuevo: agrega sólo los sub-items que no existan ya (por conceptoId).
// - Si no existe, crea el gasto (reset de pagos/montos, confirmado=false) y todos sus sub-items.
// - Para gastos `esTarjeta`, sólo se consideran sub-items con cuotas pendientes (cuotaActual < cuotasTotales).
// - Sub-items en cuotas no finalizadas se copian con cuotaActual incrementada en 1.
export async function POST(req: NextRequest) {
  const body = await req.json()
  const sourceId = Number(body.source_id)
  const mes = Number(body.mes)
  const anio = Number(body.anio)

  if (!sourceId || !mes || !anio) {
    return NextResponse.json({ error: 'source_id, mes y anio son requeridos' }, { status: 400 })
  }

  const source = await prisma.gasto.findUnique({
    where: { id: sourceId },
    include: { items: { include: { etiquetas: true } }, etiquetas: true },
  })
  if (!source) return NextResponse.json({ error: 'Gasto origen no encontrado' }, { status: 404 })

  const diaVenc = source.fechaVencimiento.split('-')[2] ?? '01'
  const nuevaFecha = `${anio}-${String(mes).padStart(2, '0')}-${diaVenc}`

  // Sub-items candidatos a copiar
  const candidatos = source.esTarjeta
    ? source.items.filter(i => i.cuotaActual != null && i.cuotasTotales != null && i.cuotaActual < i.cuotasTotales)
    : source.items

  // ¿Existe ya el gasto en el destino?
  const existente = await prisma.gasto.findFirst({
    where: {
      casaId: source.casaId,
      mes,
      anio,
      conceptoId: source.conceptoId,
    },
    include: { items: true },
  })

  const itemCreateData = (item: typeof source.items[number], gastoId: number) => ({
    gastoId,
    conceptoId: item.conceptoId,
    monto: item.monto,
    fecha: item.fecha,
    cuotaActual: nextCuota(item),
    cuotasTotales: item.cuotasTotales,
    incluyeEnTotal: item.incluyeEnTotal,
    incluyeEnVencimiento: item.incluyeEnVencimiento,
    categoriaId: item.categoriaId,
    etiquetas: { connect: (item.etiquetas ?? []).map((c: any) => ({ id: c.id })) },
  })

  if (existente) {
    // Merge: agregar sólo los sub-items que no existan (por conceptoId)
    const existentesConcepto = new Set(existente.items.map(i => i.conceptoId))
    const nuevos = candidatos.filter(i => !existentesConcepto.has(i.conceptoId))
    await Promise.all(nuevos.map(i => prisma.gastoItem.create({ data: itemCreateData(i, existente.id) })))
    return NextResponse.json({ merged: true, gasto_id: existente.id, added_items: nuevos.length })
  }

  // Crear gasto nuevo + sub-items
  const nuevo = await prisma.gasto.create({
    data: {
      casaId: source.casaId,
      conceptoId: source.conceptoId,
      fechaVencimiento: nuevaFecha,
      tipoPago: source.tipoPago,
      monedaId: source.monedaId,
      tipoCambio: source.tipoCambio,
      totalMoneda: source.totalMoneda,
      totalPagado: 0,
      pasajeMesSiguiente: 0,
      prestamo_a_otro: 0,
      tarjetaId: source.tarjetaId,
      cuotaActual: nextCuota(source),
      cuotasTotales: source.cuotasTotales,
      mes,
      anio,
      notas: source.notas,
      confirmado: false,
      categoriaId: source.categoriaId,
      etiquetas: { connect: (source.etiquetas ?? []).map((c: any) => ({ id: c.id })) },
      esTarjeta: source.esTarjeta,
    },
  })

  await Promise.all(candidatos.map(i => prisma.gastoItem.create({ data: itemCreateData(i, nuevo.id) })))

  return NextResponse.json({ created: true, gasto_id: nuevo.id, added_items: candidatos.length }, { status: 201 })
}
