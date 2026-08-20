import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { computeReportes, computeReporteSubitems, enumerateMonths } from '@/lib/reportes-compute'
import { shiftMonth } from '@/lib/fechas'

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
  const etiquetaIds = parseIds(searchParams.get('etiqueta_ids'))
  const tarjetaIds = parseIds(searchParams.get('tarjeta_ids'))
  const conceptoIds = parseIds(searchParams.get('concepto_ids'))
  const topParam = Number(searchParams.get('top'))
  const incluirTarjetas = searchParams.get('incluir_tarjetas') === 'true'
  const porSubitem = searchParams.get('agrupar') === 'subitem'
  const comparar = searchParams.get('comparar') === 'true'

  const months = enumerateMonths(mesDesde, anioDesde, mesHasta, anioHasta)

  const where: any = {
    OR: months.map(({ mes, anio }) => ({ mes, anio })),
  }
  // Los resúmenes de tarjeta son contenedores: se excluyen por defecto para no
  // doble-contar los consumos, que ya existen como gastos individuales.
  if (!incluirTarjetas) where.esTarjeta = false
  if (casa_id) where.casaId = Number(casa_id)
  if (tipo_pago === 'C' || tipo_pago === 'D') where.tipoPago = tipo_pago
  if (tarjetaIds.length) where.tarjetaId = { in: tarjetaIds }

  if (porSubitem) {
    // En el desglose por sub-ítem las dimensiones de categorización son las del sub-ítem,
    // así que el `where` (que sólo alcanza al gasto) actúa como **pre-filtro**: trae el gasto
    // si matchea él mismo o alguno de sus sub-ítems computables. El filtrado fino, unidad por
    // unidad, lo hace `computeReporteSubitems` con `filtros`.
    const and: any[] = []
    if (categoriaIds.length) and.push({ OR: [
      { categoriaId: { in: categoriaIds } },
      { items: { some: { incluyeEnTotal: true, categoriaId: { in: categoriaIds } } } },
    ] })
    if (etiquetaIds.length) and.push({ OR: [
      { etiquetas: { some: { id: { in: etiquetaIds } } } },
      { items: { some: { incluyeEnTotal: true, etiquetas: { some: { id: { in: etiquetaIds } } } } } },
    ] })
    if (conceptoIds.length) and.push({ OR: [
      { conceptoId: { in: conceptoIds } },
      { items: { some: { incluyeEnTotal: true, conceptoId: { in: conceptoIds } } } },
    ] })
    if (and.length) where.AND = and
  } else {
    if (categoriaIds.length) where.categoriaId = { in: categoriaIds }
    if (etiquetaIds.length) where.etiquetas = { some: { id: { in: etiquetaIds } } }
    if (conceptoIds.length) where.conceptoId = { in: conceptoIds }
  }

  // Para el desglose por sub-item necesitamos las categorías/concepto de cada item.
  const gastos = await prisma.gasto.findMany({
    where,
    include: {
      categoria: true,
      etiquetas: true,
      concepto: true,
      tarjeta: true,
      casa: true,
      items: porSubitem ? { include: { categoria: true, etiquetas: true, concepto: true } } : true,
    },
  })

  // Ventana anterior, del mismo largo, para la comparación de los KPIs. Se pide sólo si
  // `comparar=true`: es una segunda query y no toda vista la necesita (en la de un mes
  // único, por ejemplo, el gráfico mensual ya no se muestra).
  let totalPrevio: number | null = null
  if (comparar && months.length > 0) {
    const previos = enumerateMonths(
      shiftMonth(months[0].mes, months[0].anio, -months.length).mes,
      shiftMonth(months[0].mes, months[0].anio, -months.length).anio,
      shiftMonth(months[0].mes, months[0].anio, -1).mes,
      shiftMonth(months[0].mes, months[0].anio, -1).anio,
    )
    const gastosPrevios = await prisma.gasto.findMany({
      where: { ...where, OR: previos.map(({ mes, anio }) => ({ mes, anio })) },
      include: {
        categoria: true,
        etiquetas: true,
        concepto: true,
        tarjeta: true,
        casa: true,
        items: porSubitem ? { include: { categoria: true, etiquetas: true, concepto: true } } : true,
      },
    })
    // Mismo modo de agregación que la ventana actual: comparar un total por sub-ítem
    // contra uno a nivel gasto daría una variación inventada.
    const previo = porSubitem
      ? computeReporteSubitems(gastosPrevios, previos, { filtros: { categoriaIds, etiquetaIds, conceptoIds } })
      : computeReportes(gastosPrevios, previos)
    totalPrevio = previo.kpis.total
  }

  const topConceptos = Number.isFinite(topParam) && topParam > 0 ? Math.min(50, Math.round(topParam)) : 12
  const result = porSubitem
    ? computeReporteSubitems(gastos, months, {
        topConceptos,
        totalPrevio,
        filtros: { categoriaIds, etiquetaIds, conceptoIds },
      })
    : computeReportes(gastos, months, { topConceptos, totalPrevio })
  return NextResponse.json(result)
}
