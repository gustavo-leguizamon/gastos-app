import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { normalizeNombre } from '@/lib/conceptos'
import { promocionesConProgreso } from '@/lib/promociones-db'
import { criterioCoincide, criteriosDe, diaCoincide, medioCoincide, vigenteEnMes } from '@/lib/promociones-compute'

/** Id positivo de un query param, o `null`. */
function idParam(v: string | null): number | null {
  const n = v ? Number(v) : NaN
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * `GET /api/promociones/sugeridas` — qué promos ofrecerle al form de gasto.
 *
 * Params: `descripcion` (texto del concepto), `categoria_id`, `etiqueta_ids` (ids separados por
 * coma), `tipo_pago` (`C`/`D`), `tarjeta_id`, `mes`, `anio`, `fecha` (`YYYY-MM-DD` del día de
 * carga, opcional) y `promocion_id` (opcional).
 *
 * Una promo se sugiere si está **activa**, el gasto coincide con **alguno** de sus criterios
 * (concepto, categoría o alguna etiqueta vinculados — `criterioCoincide`), el medio de pago entra
 * (tarjeta de la promo, o débito sin tarjeta si vale en efectivo), está **vigente** en el mes
 * del gasto y, si viene `fecha`, **vale ese día de la semana** (una promo de martes no se ofrece un sábado). `promocion_id` fuerza a incluir esa promo aunque ya no coincida (con
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
  const tarjetaId = idParam(searchParams.get('tarjeta_id'))
  const forzadaId = idParam(searchParams.get('promocion_id'))
  const categoriaId = idParam(searchParams.get('categoria_id'))
  const etiquetaIds = Array.from(
    new Set((searchParams.get('etiqueta_ids') ?? '').split(',').map(idParam).filter((n): n is number => n != null)),
  )

  const fecha = searchParams.get('fecha')

  const nombre = normalizeNombre(searchParams.get('descripcion') ?? '')
  const concepto = nombre
    ? await prisma.concepto.findFirst({ where: { nombre: { equals: nombre, mode: 'insensitive' } } })
    : null

  const gasto = { conceptoId: concepto?.id ?? null, categoriaId, etiquetaIds }

  const or: any[] = []
  if (concepto) or.push({ activa: true, conceptos: { some: { id: concepto.id } } })
  if (categoriaId) or.push({ activa: true, categorias: { some: { id: categoriaId } } })
  if (etiquetaIds.length) or.push({ activa: true, etiquetas: { some: { id: { in: etiquetaIds } } } })
  if (forzadaId) or.push({ id: forzadaId })
  if (or.length === 0) return NextResponse.json([])

  const filas = await prisma.promocion.findMany({
    where: { OR: or },
    include: { conceptos: true, categorias: true, etiquetas: true, tarjetas: true, usos: { where: { mes, anio } } },
    orderBy: { lugar: 'asc' },
  })

  const candidatas = filas
    .map(p => ({
      fila: p,
      coincide:
        p.activa &&
        criterioCoincide(criteriosDe(p), gasto) &&
        vigenteEnMes(p, mes, anio) &&
        diaCoincide(p, fecha) &&
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
