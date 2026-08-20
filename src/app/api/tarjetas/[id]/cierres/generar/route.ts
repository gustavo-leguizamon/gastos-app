import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generarSiguienteCierre, ultimoCierre } from '@/lib/cierres'

function toResponse(c: any) {
  return {
    id: c.id,
    tarjeta_id: c.tarjetaId,
    mes: c.mes,
    anio: c.anio,
    fecha_cierre: c.fechaCierre ?? null,
    fecha_vencimiento: c.fechaVencimiento ?? null,
    fecha_proximo_cierre: c.fechaProximoCierre ?? null,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  }
}

/**
 * `POST /api/tarjetas/[id]/cierres/generar` — crea el cierre del período siguiente al último
 * cargado, proyectando las fechas con `generarSiguienteCierre`.
 *
 * Existe porque los cierres se cargaban a mano mes a mes y olvidarse rompe la propagación de
 * pagos a la tarjeta (400 en `POST /api/gastos/[id]/pagos`). Las fechas quedan editables: el
 * generado es un borrador con la proyección, no un dato definitivo.
 *
 * - 404 si la tarjeta no existe.
 * - 409 si no hay ningún cierre del que partir, o si el siguiente ya está cargado.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const tarjetaId = Number(params.id)
  if (!Number.isInteger(tarjetaId) || tarjetaId <= 0) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  }

  const tarjeta = await prisma.tarjeta.findUnique({
    where: { id: tarjetaId },
    include: { cierres: true },
  })
  if (!tarjeta) return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 })

  const ultimo = ultimoCierre(tarjeta.cierres)
  if (!ultimo) {
    return NextResponse.json(
      { error: 'La tarjeta no tiene ningún cierre cargado: cargá el primero a mano.' },
      { status: 409 },
    )
  }

  const siguiente = generarSiguienteCierre(ultimo)

  try {
    const creado = await prisma.tarjetaCierre.create({
      data: { tarjetaId, ...siguiente },
    })
    return NextResponse.json(toResponse(creado), { status: 201 })
  } catch (err: any) {
    // El unique (tarjetaId, mes, anio) es la guarda contra generar dos veces el mismo.
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: `El cierre de ${siguiente.mes}/${siguiente.anio} ya está cargado.` },
        { status: 409 },
      )
    }
    console.error('POST /api/tarjetas/[id]/cierres/generar failed:', err)
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 })
  }
}
