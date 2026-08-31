import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseAplicarBody } from '@/lib/presupuestos-auto'

/**
 * `POST /api/presupuestos/aplicar` — persiste el objetivo de ahorro y los topes que salieron
 * del wizard.
 *
 * Dos decisiones:
 *
 * - **Los topes vienen del cliente, no se recalculan acá.** Son los que el usuario vio y
 *   ajustó a mano; volver a repartirlos en el server desharía esos ajustes.
 * - **Reemplaza los topes del período** (`deleteMany` + `createMany` en la misma transacción),
 *   a diferencia de `/copiar`, que no pisa nada. Generar es una propuesta **completa** del
 *   mes: si una categoría no está en ella es porque no debe tener tope, y dejar el anterior
 *   dando vueltas rompería la suma contra el objetivo. La pantalla lo confirma antes.
 *
 * El objetivo se guarda con los supuestos con los que se generó (ingresos esperados, base,
 * ventana de histórico) — sin ellos no se puede recalcular ni explicar de dónde salió cada
 * tope.
 */
export async function POST(req: NextRequest) {
  const parsed = parseAplicarBody(await req.json())
  if (!parsed) {
    return NextResponse.json(
      { error: 'mes, anio, objetivo, ingresos_esperados y filas (categoria_id + monto >= 0) son requeridos' },
      { status: 400 },
    )
  }
  const { mes, anio, base, objetivo, ingresosEsperados, mesesHistorico, filas } = parsed

  const ids = filas.map(f => f.categoriaId)
  const existentes = await prisma.categoria.findMany({ where: { id: { in: ids } }, select: { id: true } })
  if (existentes.length !== ids.length) {
    return NextResponse.json({ error: 'Alguna categoría no existe' }, { status: 404 })
  }

  await prisma.$transaction([
    prisma.objetivoAhorro.upsert({
      where: { mes_anio: { mes, anio } },
      create: { mes, anio, monto: objetivo, ingresosEsperados, base, mesesHistorico },
      update: { monto: objetivo, ingresosEsperados, base, mesesHistorico },
    }),
    prisma.presupuesto.deleteMany({ where: { mes, anio } }),
    prisma.presupuesto.createMany({
      data: filas.map(f => ({ categoriaId: f.categoriaId, mes, anio, monto: f.monto, fijado: f.fijado })),
    }),
  ])

  return NextResponse.json({ ok: true, aplicados: filas.length, objetivo, base })
}
