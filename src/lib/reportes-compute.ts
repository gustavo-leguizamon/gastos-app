// Cómputo puro para el endpoint `/api/reportes`. Sin imports de Prisma/Next para
// poder testear en aislamiento: la route arma el `where`, trae los gastos y delega
// toda la agregación acá.
//
// Métrica: `total_ars` de cada gasto (misma definición que `/api/gastos/evolucion`):
// si el gasto no está confirmado y tiene sub-items, usa la suma de los items
// `incluyeEnTotal`; en caso contrario `totalMoneda × tipoCambio`.
//
// Atribución por categoría: un gasto con N categorías suma su total COMPLETO a cada
// una (decisión de producto — "cuánto tocó la categoría X"). Por eso la suma de
// categorías puede superar el total. Gastos sin categorías caen en "Sin categoría".
//
// Los gastos `esTarjeta` (resúmenes contenedores de tarjeta) se excluyen en la route
// para no doble-contar los consumos, que ya viven como gastos individuales.

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export interface CategoriaBucket {
  id: number | null
  nombre: string
  total_ars: number
}

export interface MesBucket {
  mes: number
  anio: number
  label: string
  total_ars: number
}

export interface ConceptoBucket {
  concepto_id: number
  nombre: string
  total_ars: number
}

export interface TarjetaBucket {
  id: number | null
  nombre: string
  total_ars: number
}

export interface TipoPagoBucket {
  tipo: 'C' | 'D'
  nombre: string
  total_ars: number
}

export interface ReporteResult {
  kpis: {
    total: number
    promedio_mensual: number
    cantidad_gastos: number
    meses: number
  }
  por_categoria: CategoriaBucket[]
  por_mes: MesBucket[]
  top_conceptos: ConceptoBucket[]
  por_tarjeta: TarjetaBucket[]
  por_tipo_pago: TipoPagoBucket[]
}

const TIPO_PAGO_NOMBRE: Record<'C' | 'D', string> = { C: 'Crédito', D: 'Débito' }

const MAX_MESES = 60

/**
 * Lista cronológica de `{mes, anio}` entre (mesDesde, anioDesde) y (mesHasta, anioHasta),
 * ambos inclusive. Si el rango viene invertido lo endereza. Acota a `MAX_MESES` meses
 * (recorta desde el inicio) para evitar ventanas absurdas.
 */
export function enumerateMonths(
  mesDesde: number,
  anioDesde: number,
  mesHasta: number,
  anioHasta: number,
): { mes: number; anio: number }[] {
  let start = anioDesde * 12 + (mesDesde - 1)
  let end = anioHasta * 12 + (mesHasta - 1)
  if (end < start) { const t = start; start = end; end = t }
  if (end - start + 1 > MAX_MESES) start = end - MAX_MESES + 1
  const out: { mes: number; anio: number }[] = []
  for (let i = start; i <= end; i++) {
    out.push({ mes: (i % 12) + 1, anio: Math.floor(i / 12) })
  }
  return out
}

// Total ARS del gasto (ver nota de cabecera).
function gastoTotalArs(g: any): number {
  if (!g.confirmado && g.items?.length) {
    return g.items.filter((i: any) => i.incluyeEnTotal).reduce((s: number, i: any) => s + i.monto, 0)
  }
  return g.totalMoneda * g.tipoCambio
}

/**
 * Agrega los gastos ya filtrados en las tres dimensiones del reporte + KPIs.
 * `months` es la ventana cronológica (de `enumerateMonths`); los meses sin gastos
 * quedan con total 0. `opts.topConceptos` acota el ranking de conceptos (default 12).
 */
export function computeReportes(
  gastos: any[],
  months: { mes: number; anio: number }[],
  opts: { topConceptos?: number } = {},
): ReporteResult {
  const topN = opts.topConceptos ?? 12
  const r = (n: number) => Math.round(n * 100) / 100

  const mesMap = new Map<string, MesBucket>()
  for (const { mes, anio } of months) {
    mesMap.set(`${anio}-${mes}`, {
      mes,
      anio,
      label: `${MESES_CORTOS[mes - 1]} ${String(anio).slice(2)}`,
      total_ars: 0,
    })
  }

  const catMap = new Map<string, CategoriaBucket>()
  const conMap = new Map<number, ConceptoBucket>()
  const tarjMap = new Map<string, TarjetaBucket>()
  const tipoMap = new Map<'C' | 'D', TipoPagoBucket>()
  let total = 0
  let cantidad = 0

  for (const g of gastos) {
    const monto = gastoTotalArs(g)
    total += monto
    cantidad++

    const mb = mesMap.get(`${g.anio}-${g.mes}`)
    if (mb) mb.total_ars += monto

    const cats: any[] = g.categorias ?? []
    if (cats.length === 0) {
      const ex = catMap.get('null') ?? { id: null, nombre: 'Sin categoría', total_ars: 0 }
      ex.total_ars += monto
      catMap.set('null', ex)
    } else {
      for (const c of cats) {
        const key = String(c.id)
        const ex = catMap.get(key) ?? { id: c.id, nombre: c.nombre, total_ars: 0 }
        ex.total_ars += monto
        catMap.set(key, ex)
      }
    }

    const cid = g.conceptoId
    const ce = conMap.get(cid) ?? { concepto_id: cid, nombre: g.concepto?.nombre ?? '—', total_ars: 0 }
    ce.total_ars += monto
    conMap.set(cid, ce)

    const tkey = g.tarjetaId == null ? 'null' : String(g.tarjetaId)
    const te = tarjMap.get(tkey) ?? { id: g.tarjetaId ?? null, nombre: g.tarjeta?.nombre ?? 'Sin tarjeta', total_ars: 0 }
    te.total_ars += monto
    tarjMap.set(tkey, te)

    if (g.tipoPago === 'C' || g.tipoPago === 'D') {
      const tp = g.tipoPago as 'C' | 'D'
      const pe = tipoMap.get(tp) ?? { tipo: tp, nombre: TIPO_PAGO_NOMBRE[tp], total_ars: 0 }
      pe.total_ars += monto
      tipoMap.set(tp, pe)
    }
  }

  const por_mes = months.map(({ mes, anio }) => {
    const b = mesMap.get(`${anio}-${mes}`)!
    return { ...b, total_ars: r(b.total_ars) }
  })
  const por_categoria = Array.from(catMap.values())
    .map((c) => ({ ...c, total_ars: r(c.total_ars) }))
    .sort((a, b) => b.total_ars - a.total_ars)
  const top_conceptos = Array.from(conMap.values())
    .map((c) => ({ ...c, total_ars: r(c.total_ars) }))
    .sort((a, b) => b.total_ars - a.total_ars)
    .slice(0, topN)
  const por_tarjeta = Array.from(tarjMap.values())
    .map((t) => ({ ...t, total_ars: r(t.total_ars) }))
    .sort((a, b) => b.total_ars - a.total_ars)
  const por_tipo_pago = Array.from(tipoMap.values())
    .map((t) => ({ ...t, total_ars: r(t.total_ars) }))
    .sort((a, b) => b.total_ars - a.total_ars)

  const meses = months.length
  return {
    kpis: {
      total: r(total),
      promedio_mensual: r(meses ? total / meses : 0),
      cantidad_gastos: cantidad,
      meses,
    },
    por_categoria,
    por_mes,
    top_conceptos,
    por_tarjeta,
    por_tipo_pago,
  }
}
