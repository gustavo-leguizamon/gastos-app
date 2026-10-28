import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validarReferenciasPromocion } from '@/lib/promociones-refs'
import { promocionesConProgreso } from '@/lib/promociones-db'
import { parsePromocionBody, toPromocionResponse, totalesPromociones } from '@/lib/promociones-compute'

const INCLUDE = { concepto: true, tarjetas: true } as const

/**
 * `GET /api/promociones?mes=&anio=` — las promociones con su **progreso en el período**.
 *
 * La promo es una regla recurrente (no hay una por mes); lo que depende del período —consumo,
 * reintegro, lo que falta para el tope, si está vigente— se calcula acá y viaja en la misma
 * respuesta, para que el cliente no tenga que cruzar promos contra gastos por su cuenta.
 *
 * El consumo es la suma de dos fuentes: los gastos del mes **asociados** a la promo
 * (`Gasto.promocionId`) y los usos cargados a mano. Ver `promocionesConProgreso`.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mes = Number(searchParams.get('mes'))
  const anio = Number(searchParams.get('anio'))

  if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio)) {
    return NextResponse.json({ error: 'mes (1-12) y anio son requeridos' }, { status: 400 })
  }

  const filas = await prisma.promocion.findMany({
    include: { ...INCLUDE, usos: { where: { mes, anio }, orderBy: { fecha: 'desc' } } },
    orderBy: { lugar: 'asc' },
  })

  const items = await promocionesConProgreso(filas, mes, anio)
  return NextResponse.json({ mes, anio, promociones: items, totales: totalesPromociones(items) })
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
      conceptoId: data.conceptoId,
      porcentaje: data.porcentaje,
      topeMensual: data.topeMensual,
      dias: data.dias,
      efectivo: data.efectivo,
      activa: data.activa,
      notas: data.notas,
      vigenteDesde: data.vigenteDesde,
      vigenteHasta: data.vigenteHasta,
      tarjetas: { connect: data.tarjetaIds.map(id => ({ id })) },
    },
    include: INCLUDE,
  })
  return NextResponse.json(toPromocionResponse(creada), { status: 201 })
}
