import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { normalizeNombre } from '@/lib/conceptos'
import { cicloDePeriodo, promocionesConProgreso } from '@/lib/promociones-db'
import type { PeriodoPromo } from '@/lib/promociones-db'
import { mesAnioDeFecha } from '@/lib/ingresos-compute'
import { criterioCoincide, criteriosDe, diaCoincide, medioCoincide, vigenteEnCiclo } from '@/lib/promociones-compute'

/** Id positivo de un query param, o `null`. */
function idParam(v: string | null): number | null {
  const n = v ? Number(v) : NaN
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * `GET /api/promociones/sugeridas` — qué promos ofrecerle al form de gasto.
 *
 * Params: `descripcion` (texto del concepto), `categoria_id`, `etiqueta_ids` (ids separados por
 * coma), `tipo_pago` (`C`/`D`), `tarjeta_id`, `mes`, `anio`, `fecha` (`YYYY-MM-DD` de la compra
 * con la promo, opcional: decide el día de la semana y el ciclo del tope) y `promocion_id` (opcional).
 *
 * Una promo se sugiere si está **activa**, el gasto coincide con **alguno** de sus criterios
 * (concepto, categoría o alguna etiqueta vinculados — `criterioCoincide`), el medio de pago entra
 * (tarjeta de la promo, o débito sin tarjeta si vale en efectivo), está **vigente** en el mes
 * del gasto y, si viene `fecha`, **vale ese día de la semana** (una promo de martes no se ofrece un sábado). `promocion_id` fuerza a incluir esa promo aunque ya no coincida (con
 * `coincide: false`): al editar un gasto ya asociado, la opción actual no puede desaparecer
 * del select o se perdería la asociación sin avisar.
 *
 * Devuelve `{ id, lugar, tipo, porcentaje, monto_reintegro, compra_minima, disponible, tope_alcanzado, coincide }[]` — `disponible`
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
    include: { conceptos: true, categorias: true, etiquetas: true, tarjetas: true },
    orderBy: { lugar: 'asc' },
  })

  // Con fecha de compra, el ciclo de cada promo sale de esa fecha (y de su día de reinicio): es
  // el ciclo al que va a contar el gasto. Sin fecha, el que empieza en el mes del gasto.
  const periodo: PeriodoPromo = mesAnioDeFecha(fecha) ? { fecha: fecha as string } : { mes, anio }

  const candidatas = filas
    .map(p => {
      const ciclo = cicloDePeriodo(p, periodo)
      return {
        fila: p,
        coincide:
          p.activa &&
          criterioCoincide(criteriosDe(p), gasto) &&
          vigenteEnCiclo(p, ciclo.mes, ciclo.anio) &&
          diaCoincide(p, fecha) &&
          medioCoincide({ tarjetaIds: p.tarjetas.map(t => t.id), efectivo: p.efectivo }, { tipoPago, tarjetaId }),
      }
    })
    .filter(c => c.coincide || c.fila.id === forzadaId)

  const conProgreso = await promocionesConProgreso(candidatas.map(c => c.fila), periodo)
  return NextResponse.json(
    conProgreso.map((p, i) => ({
      id: p.id,
      lugar: p.lugar,
      tipo: p.tipo,
      porcentaje: p.porcentaje,
      monto_reintegro: p.monto_reintegro,
      compra_minima: p.compra_minima,
      disponible: p.progreso.disponible,
      tope_alcanzado: p.progreso.estado === 'tope_alcanzado',
      coincide: candidatas[i].coincide,
    })),
  )
}
