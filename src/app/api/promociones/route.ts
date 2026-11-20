import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validarReferenciasPromocion } from '@/lib/promociones-refs'
import { promocionesConProgreso } from '@/lib/promociones-db'
import { parsePromocionBody, toPromocionResponse, totalesPromociones } from '@/lib/promociones-compute'
import { mesAnioDeFecha } from '@/lib/ingresos-compute'
import { fechaEnTimeZone } from '@/lib/fechas'

const INCLUDE = { conceptos: true, categorias: true, etiquetas: true, tarjetas: true } as const

/**
 * `GET /api/promociones?mes=&anio=[&hoy=YYYY-MM-DD][&actual=1]` — las promociones con su
 * **progreso en el ciclo** y su **saldo a favor**.
 *
 * La promo es una regla recurrente (no hay una por mes); lo que depende del ciclo —consumo,
 * reintegro, lo que falta para el tope, si está vigente— se calcula acá y viaja en la misma
 * respuesta, para que el cliente no tenga que cruzar promos contra gastos por su cuenta.
 *
 * - Sin `actual`: de cada promo, el ciclo que **empieza** en `mes`/`anio`.
 * - Con `actual=1`: de cada promo, el ciclo **en curso** el día `hoy` (con reinicio el 5, el 03/12
 *   todavía es noviembre). Es lo que miran "Hoy" y el popup de `/gastos`.
 *
 * El saldo (lo reintegrado menos lo usado y lo vencido) se calcula siempre al día `hoy` — la
 * fecha local del cliente; sin ella, la de Argentina. Ver `promocionesConProgreso`.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mes = Number(searchParams.get('mes'))
  const anio = Number(searchParams.get('anio'))

  if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio)) {
    return NextResponse.json({ error: 'mes (1-12) y anio son requeridos' }, { status: 400 })
  }
  const hoyParam = searchParams.get('hoy')
  const hoy = mesAnioDeFecha(hoyParam) ? (hoyParam as string) : fechaEnTimeZone(new Date())
  const actual = searchParams.get('actual') === '1'

  const filas = await prisma.promocion.findMany({ include: INCLUDE, orderBy: { lugar: 'asc' } })

  const items = await promocionesConProgreso(filas, actual ? { fecha: hoy } : { mes, anio }, { saldoAl: hoy })
  return NextResponse.json({ mes, anio, hoy, promociones: items, totales: totalesPromociones(items) })
}

/** `POST /api/promociones` — alta de una promoción. */
export async function POST(req: NextRequest) {
  const data = parsePromocionBody(await req.json())
  if (!data) return NextResponse.json({ error: 'Datos de la promoción inválidos' }, { status: 400 })

  const error = await validarReferenciasPromocion(data)
  if (error) return NextResponse.json({ error }, { status: 400 })

  const creada = await prisma.promocion.create({
    data: {
      lugar: data.lugar,
      porcentaje: data.porcentaje,
      topeMensual: data.topeMensual,
      tipo: data.tipo,
      montoReintegro: data.montoReintegro,
      compraMinima: data.compraMinima,
      dias: data.dias,
      efectivo: data.efectivo,
      modalidad: data.modalidad,
      activa: data.activa,
      notas: data.notas,
      vigenteDesde: data.vigenteDesde,
      vigenteHasta: data.vigenteHasta,
      diaReinicio: data.diaReinicio,
      tarjetas: { connect: data.tarjetaIds.map(id => ({ id })) },
      conceptos: { connect: data.conceptoIds.map(id => ({ id })) },
      categorias: { connect: data.categoriaIds.map(id => ({ id })) },
      etiquetas: { connect: data.etiquetaIds.map(id => ({ id })) },
    },
    include: INCLUDE,
  })
  return NextResponse.json(toPromocionResponse(creada), { status: 201 })
}
