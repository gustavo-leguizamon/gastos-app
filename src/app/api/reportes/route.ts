import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { computeReportes, computeReporteSubitems, enumerateMonths } from '@/lib/reportes-compute'

// Parsea una lista de ids "1,2,3" a number[] (descarta no numéricos y vacíos).
function parseIds(raw: string | null): number[] {
  if (!raw) return []
  return raw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mesDesde = Number(searchParams.get('mes_desde'))
  const anioDesde = Number(searchParams.get('anio_desde'))
  const mesHasta = Number(searchParams.get('mes_hasta'))
  const anioHasta = Number(searchParams.get('anio_hasta'))

  if (!mesDesde || !anioDesde || !mesHasta || !anioHasta) {
    return NextResponse.json(
      { error: 'Faltan parámetros: mes_desde, anio_desde, mes_hasta, anio_hasta' },
      { status: 400 },
    )
  }

  const casa_id = searchParams.get('casa_id')
  const tipo_pago = searchParams.get('tipo_pago')
  const categoriaIds = parseIds(searchParams.get('categoria_ids'))
  const tarjetaIds = parseIds(searchParams.get('tarjeta_ids'))
  const conceptoIds = parseIds(searchParams.get('concepto_ids'))
  const topParam = Number(searchParams.get('top'))
  const incluirTarjetas = searchParams.get('incluir_tarjetas') === 'true'
  const porSubitem = searchParams.get('agrupar') === 'subitem'

  const months = enumerateMonths(mesDesde, anioDesde, mesHasta, anioHasta)

  const where: any = {
    OR: months.map(({ mes, anio }) => ({ mes, anio })),
  }
  // Los resúmenes de tarjeta son contenedores: se excluyen por defecto para no
  // doble-contar los consumos, que ya existen como gastos individuales.
  if (!incluirTarjetas) where.esTarjeta = false
  if (casa_id) where.casaId = Number(casa_id)
  if (tipo_pago === 'C' || tipo_pago === 'D') where.tipoPago = tipo_pago
  if (categoriaIds.length) where.categorias = { some: { id: { in: categoriaIds } } }
  if (tarjetaIds.length) where.tarjetaId = { in: tarjetaIds }
  if (conceptoIds.length) where.conceptoId = { in: conceptoIds }

  // Para el desglose por sub-item necesitamos las categorías/concepto de cada item.
  const gastos = await prisma.gasto.findMany({
    where,
    include: {
      categorias: true,
      concepto: true,
      tarjeta: true,
      items: porSubitem ? { include: { categorias: true, concepto: true } } : true,
    },
  })

  const topConceptos = Number.isFinite(topParam) && topParam > 0 ? Math.min(50, Math.round(topParam)) : 12
  const result = porSubitem
    ? computeReporteSubitems(gastos, months, { topConceptos })
    : computeReportes(gastos, months, { topConceptos })
  return NextResponse.json(result)
}
