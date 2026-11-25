import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { shiftMonth } from '@/lib/fechas'
import { proyectarCuotas, seleccionarResumenes, type CuotaFuente } from '@/lib/cuotas-proyeccion'

/** Hasta cuántos meses atrás se busca el resumen base de una tarjeta. */
const VENTANA_BASE_MESES = 12

// Cuotas de tarjeta comprometidas desde el (mes, anio) consultado hasta la última.
// No persiste nada: proyecta los sub-items con cuotas de los resúmenes ya cargados.
// Ver src/lib/cuotas-proyeccion.ts y docs/claude/tarjetas.md → Proyección de cuotas.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mes = Number(searchParams.get('mes'))
  const anio = Number(searchParams.get('anio'))
  const casaId = searchParams.get('casa_id') ? Number(searchParams.get('casa_id')) : null

  if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio) || anio < 1) {
    return NextResponse.json({ error: 'mes/anio inválidos' }, { status: 400 })
  }

  const desde = shiftMonth(mes, anio, -VENTANA_BASE_MESES)
  const resumenes = await prisma.gasto.findMany({
    where: {
      esTarjeta: true,
      ...(casaId ? { casaId } : {}),
      OR: [{ anio: { gt: desde.anio } }, { anio: desde.anio, mes: { gte: desde.mes } }],
    },
    select: {
      id: true,
      tarjetaId: true,
      casaId: true,
      mes: true,
      anio: true,
      tarjeta: { select: { nombre: true, banco: true } },
      items: {
        where: { cuotaActual: { not: null }, cuotasTotales: { not: null }, incluyeEnTotal: true },
        select: {
          conceptoId: true,
          monto: true,
          cuotaActual: true,
          cuotasTotales: true,
          concepto: { select: { nombre: true } },
        },
      },
    },
  })

  const elegidos = seleccionarResumenes(
    resumenes.map(r => ({ ...r, tarjeta_id: r.tarjetaId, casa_id: r.casaId })),
    { mes, anio },
  )

  const fuentes: CuotaFuente[] = elegidos.flatMap(r =>
    r.items.map(it => ({
      gasto_id: r.id,
      tarjeta_id: r.tarjetaId,
      tarjeta: r.tarjeta ? (r.tarjeta.banco ? `${r.tarjeta.nombre} (${r.tarjeta.banco})` : r.tarjeta.nombre) : 'Sin tarjeta',
      casa_id: r.casaId,
      concepto_id: it.conceptoId,
      concepto: it.concepto.nombre,
      monto: it.monto,
      cuota_actual: it.cuotaActual as number,
      cuotas_totales: it.cuotasTotales as number,
      mes: r.mes,
      anio: r.anio,
    })),
  )

  return NextResponse.json(proyectarCuotas(fuentes, { mes, anio }))
}
