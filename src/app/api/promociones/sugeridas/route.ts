import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { normalizeNombre } from '@/lib/conceptos'
import { promocionesConProgreso } from '@/lib/promociones-db'
import { medioCoincide, vigenteEnMes } from '@/lib/promociones-compute'

/**
 * `GET /api/promociones/sugeridas` — qué promos ofrecerle al form de gasto.
 *
 * Params: `descripcion` (texto del concepto), `tipo_pago` (`C`/`D`), `tarjeta_id`, `mes`,
 * `anio` y `promocion_id` (opcional).
 *
 * Una promo se sugiere si está **activa**, es del concepto del gasto, el medio de pago entra
 * (tarjeta de la promo, o débito sin tarjeta si vale en efectivo) y está **vigente** en el mes
 * del gasto. `promocion_id` fuerza a incluir esa promo aunque ya no coincida (con
 * `coincide: false`): al editar un gasto ya asociado, la opción actual no puede desaparecer
 * del select o se perdería la asociación sin avisar.
 *
 * Devuelve `{ id, lugar, porcentaje, disponible, tope_alcanzado, coincide }[]` — `disponible`
 * es lo que queda por reintegrar en ese mes, para que el form lo muestre al elegir.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mes = Number(searchParams.get('mes'))
  const anio = Number(searchParams.get('anio'))
  if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio)) {
    return NextResponse.json({ error: 'mes (1-12) y anio son requeridos' }, { status: 400 })
  }

  const tipoPago = searchParams.get('tipo_pago') ?? 'D'
  const tarjetaRaw = searchParams.get('tarjeta_id')
  const tarjetaNum = tarjetaRaw ? Number(tarjetaRaw) : null
  const tarjetaId = tarjetaNum != null && Number.isInteger(tarjetaNum) && tarjetaNum > 0 ? tarjetaNum : null
  const forzadaRaw = searchParams.get('promocion_id')
  const forzadaId = forzadaRaw && Number(forzadaRaw) > 0 ? Number(forzadaRaw) : null

  const nombre = normalizeNombre(searchParams.get('descripcion') ?? '')
  const concepto = nombre
    ? await prisma.concepto.findFirst({ where: { nombre: { equals: nombre, mode: 'insensitive' } } })
    : null

  const or: any[] = []
  if (concepto) or.push({ activa: true, conceptoId: concepto.id })
  if (forzadaId) or.push({ id: forzadaId })
  if (or.length === 0) return NextResponse.json([])

  const filas = await prisma.promocion.findMany({
    where: { OR: or },
    include: { concepto: true, tarjetas: true, usos: { where: { mes, anio } } },
    orderBy: { lugar: 'asc' },
  })

  const candidatas = filas
    .map(p => ({
      fila: p,
      coincide:
        p.activa &&
        concepto != null &&
        p.conceptoId === concepto.id &&
        vigenteEnMes(p, mes, anio) &&
        medioCoincide({ tarjetaIds: p.tarjetas.map(t => t.id), efectivo: p.efectivo }, { tipoPago, tarjetaId }),
    }))
    .filter(c => c.coincide || c.fila.id === forzadaId)

  const conProgreso = await promocionesConProgreso(candidatas.map(c => c.fila), mes, anio)
  return NextResponse.json(
    conProgreso.map((p, i) => ({
      id: p.id,
      lugar: p.lugar,
      porcentaje: p.porcentaje,
      disponible: p.progreso.disponible,
      tope_alcanzado: p.progreso.estado === 'tope_alcanzado',
      coincide: candidatas[i].coincide,
    })),
  )
}
