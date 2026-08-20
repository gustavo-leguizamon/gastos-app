// Cómputo puro para el endpoint `/api/reportes`. Sin imports de Prisma/Next para
// poder testear en aislamiento: la route arma el `where`, trae los gastos y delega
// toda la agregación acá.
//
// Métrica: `total_ars` de cada gasto (misma definición que `/api/gastos/evolucion`):
// si el gasto no está confirmado y tiene sub-items, usa la suma de los items
// `incluyeEnTotal`; en caso contrario `totalMoneda × tipoCambio`.
//
// La agregación trabaja sobre "unidades" (`Unit`): cada unidad tiene un monto y las
// dimensiones. Hay dos formas de generar unidades a partir de los gastos:
//   - `gastosToUnits`      → una unidad por gasto (nivel gasto).
//   - `gastosToSubitemUnits`→ una unidad por sub-item `incluyeEnTotal`; si el gasto no
//                             tiene sub-items elegibles, cae al nivel gasto.
//
// Dimensiones de categorización (modelo nuevo):
//   - **categoría** (única por unidad) → PARTICIÓN: `por_categoria` suma 100% del total,
//     sin duplicar. Unidades sin categoría caen en "Sin categoría".
//   - **etiquetas** (varias por unidad) → COBERTURA: `por_etiqueta` suma el monto COMPLETO
//     a cada etiqueta (se solapan a propósito, puede superar el total). Sin etiquetas →
//     "Sin etiqueta".
//
// Los gastos `esTarjeta` (resúmenes contenedores) se excluyen en la route por defecto
// para no doble-contar los consumos, que ya existen como gastos individuales.
//
// Filtros de categorización en el modo sub-ítem: el `where` de Prisma sólo puede filtrar
// a nivel gasto, así que en `computeReporteSubitems` se filtra **por unidad** (ver
// `filterUnits`). Un sub-ítem matchea si matchea él mismo **o** su gasto padre (el
// sub-ítem "hereda" el contexto del contenedor: p. ej. la categoría "Tarjeta crédito" del
// resumen aplica a todos sus consumos).

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

export interface CasaBucket {
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
    /**
     * Total de la ventana **inmediatamente anterior**, del mismo largo (ej. con "últimos 6"
     * son los 6 meses previos). `null` cuando el caller no la pidió: los KPIs eran todos
     * absolutos y un número sin referencia no dice si el mes fue caro o barato.
     */
    total_previo: number | null
    /**
     * Variación porcentual contra `total_previo`. `null` si no hay comparación o si el
     * período previo fue 0 — dividir por cero daría un "+∞%" que no informa nada.
     */
    variacion_pct: number | null
  }
  por_categoria: CategoriaBucket[]
  por_etiqueta: CategoriaBucket[]
  por_mes: MesBucket[]
  top_conceptos: ConceptoBucket[]
  por_tarjeta: TarjetaBucket[]
  por_tipo_pago: TipoPagoBucket[]
  /** Partición por casa. `id: null` = "Sin casa" (no debería darse: `casaId` es obligatorio). */
  por_casa: CasaBucket[]
}

const TIPO_PAGO_NOMBRE: Record<'C' | 'D', string> = { C: 'Crédito', D: 'Débito' }

export interface AggregateOpts {
  /** Límite del ranking de conceptos (default 12). */
  topConceptos?: number
  /** Total de la ventana anterior, para los KPIs de comparación. Omitir = sin comparación. */
  totalPrevio?: number | null
}

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

interface Unit {
  monto: number
  categoriaId: number | null
  categoriaNombre: string | null
  etiquetas: { id: number; nombre: string }[]
  conceptoId: number
  conceptoNombre: string
  mes: number
  anio: number
  tarjetaId: number | null
  tarjetaNombre: string | null
  casaId: number | null
  casaNombre: string | null
  tipoPago: 'C' | 'D' | null
  // Índice del gasto que originó la unidad (para contar gastos distintos en el KPI).
  gastoIndex: number
  // Dimensiones del gasto padre — sólo para filtrar (herencia), nunca para agregar.
  padre: { categoriaId: number | null; etiquetaIds: number[]; conceptoId: number }
}

function normTipo(t: any): 'C' | 'D' | null {
  return t === 'C' || t === 'D' ? t : null
}

function padreDims(g: any) {
  return {
    categoriaId: g.categoriaId ?? null,
    etiquetaIds: ((g.etiquetas ?? []) as { id: number }[]).map((e) => e.id),
    conceptoId: g.conceptoId,
  }
}

// Una unidad por gasto (nivel gasto).
export function gastosToUnits(gastos: any[]): Unit[] {
  return gastos.map((g, gastoIndex) => ({
    monto: gastoTotalArs(g),
    categoriaId: g.categoriaId ?? null,
    categoriaNombre: g.categoria?.nombre ?? null,
    etiquetas: g.etiquetas ?? [],
    conceptoId: g.conceptoId,
    conceptoNombre: g.concepto?.nombre ?? '—',
    mes: g.mes,
    anio: g.anio,
    tarjetaId: g.tarjetaId ?? null,
    tarjetaNombre: g.tarjeta?.nombre ?? null,
    casaId: g.casaId ?? null,
    casaNombre: g.casa?.nombre ?? null,
    tipoPago: normTipo(g.tipoPago),
    gastoIndex,
    padre: padreDims(g),
  }))
}

// Una unidad por sub-item `incluyeEnTotal`; si el gasto no tiene sub-items elegibles,
// cae al nivel gasto. Las dimensiones de tarjeta/tipo de pago/mes son las del gasto padre;
// la categoría/etiquetas son las del sub-item (o del gasto en el fallback).
//
// Los resúmenes de tarjeta (`esTarjeta`) son contenedores de crédito: cada sub-item es un
// consumo facturado en ese mes. Aunque el gasto contenedor tenga `tipoPago = 'D'` (default al
// crearse), sus sub-items se cuentan como **crédito** (`'C'`) — así el reporte por tipo de pago
// refleja que ese monto es consumo de tarjeta. Incluyendo los resúmenes (`incluir_tarjetas`),
// el total del mes coincide con el que muestra la pantalla de Gastos.
//
// El monto es el del sub-item **tal cual** (sin escalar al total del gasto): si la suma de
// sub-items de un gasto confirmado difiere de su `totalMoneda × tipoCambio` es un error de carga
// del dato, y el reporte debe exponerlo (no enmascararlo) — al corregir los sub-items, los montos
// coinciden con la pantalla.
export function gastosToSubitemUnits(gastos: any[]): Unit[] {
  const out: Unit[] = []
  gastos.forEach((g, gastoIndex) => {
    // Un sub-item de un resumen de tarjeta es, por definición, un consumo de crédito.
    const tipoPago: 'C' | 'D' | null = g.esTarjeta ? 'C' : normTipo(g.tipoPago)
    const padre = padreDims(g)
    const itemsIncl = (g.items ?? []).filter((i: any) => i.incluyeEnTotal)
    if (itemsIncl.length > 0) {
      for (const it of itemsIncl) {
        out.push({
          monto: it.monto,
          categoriaId: it.categoriaId ?? null,
          categoriaNombre: it.categoria?.nombre ?? null,
          etiquetas: it.etiquetas ?? [],
          conceptoId: it.conceptoId,
          conceptoNombre: it.concepto?.nombre ?? '—',
          mes: g.mes,
          anio: g.anio,
          tarjetaId: g.tarjetaId ?? null,
          tarjetaNombre: g.tarjeta?.nombre ?? null,
          casaId: g.casaId ?? null,
          casaNombre: g.casa?.nombre ?? null,
          tipoPago,
          gastoIndex,
          padre,
        })
      }
    } else {
      out.push({
        monto: gastoTotalArs(g),
        categoriaId: g.categoriaId ?? null,
        categoriaNombre: g.categoria?.nombre ?? null,
        etiquetas: g.etiquetas ?? [],
        conceptoId: g.conceptoId,
        conceptoNombre: g.concepto?.nombre ?? '—',
        mes: g.mes,
        anio: g.anio,
        tarjetaId: g.tarjetaId ?? null,
        tarjetaNombre: g.tarjeta?.nombre ?? null,
        casaId: g.casaId ?? null,
        casaNombre: g.casa?.nombre ?? null,
        tipoPago,
        gastoIndex,
        padre,
      })
    }
  })
  return out
}

/**
 * Filtros de categorización aplicados a nivel unidad (sub-ítem). Vacío/ausente = sin filtrar.
 * Entre dimensiones distintas la semántica es AND; dentro de una dimensión, OR (igual que
 * el `where` de la route a nivel gasto).
 */
export interface UnitFilters {
  categoriaIds?: number[]
  etiquetaIds?: number[]
  conceptoIds?: number[]
}

const anyIn = (ids: number[], values: (number | null)[]) =>
  values.some((v) => v != null && ids.includes(v))

/**
 * Filtra unidades por las dimensiones de categorización. Una unidad matecha si matchea
 * el sub-ítem **o** su gasto padre — el sub-ítem hereda el contexto del contenedor, así
 * un filtro por la categoría del resumen de tarjeta no descarta sus consumos, y un filtro
 * por una etiqueta cargada sólo en los sub-ítems tampoco descarta el gasto.
 */
export function filterUnits(units: Unit[], f: UnitFilters = {}): Unit[] {
  const cats = f.categoriaIds ?? []
  const etis = f.etiquetaIds ?? []
  const cons = f.conceptoIds ?? []
  if (!cats.length && !etis.length && !cons.length) return units
  return units.filter((u) => {
    if (cats.length && !anyIn(cats, [u.categoriaId, u.padre.categoriaId])) return false
    if (etis.length && !anyIn(etis, [...u.etiquetas.map((e) => e.id), ...u.padre.etiquetaIds])) return false
    if (cons.length && !anyIn(cons, [u.conceptoId, u.padre.conceptoId])) return false
    return true
  })
}

/**
 * Agrega un conjunto de unidades en las dimensiones del reporte + KPIs.
 * `months` es la ventana cronológica (de `enumerateMonths`); los meses sin unidades
 * quedan con total 0. `cantidadGastos` es la cantidad de filas de gasto (para el KPI,
 * independiente de cuántas unidades genere cada gasto). `opts.topConceptos` acota el
 * ranking de conceptos (default 12).
 */
function aggregateUnits(
  units: Unit[],
  months: { mes: number; anio: number }[],
  cantidadGastos: number,
  opts: AggregateOpts = {},
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
  const etiqMap = new Map<string, CategoriaBucket>()
  const conMap = new Map<number, ConceptoBucket>()
  const tarjMap = new Map<string, TarjetaBucket>()
  const casaMap = new Map<string, CasaBucket>()
  const tipoMap = new Map<'C' | 'D', TipoPagoBucket>()
  let total = 0

  for (const u of units) {
    total += u.monto

    const mb = mesMap.get(`${u.anio}-${u.mes}`)
    if (mb) mb.total_ars += u.monto

    // Categoría: partición (una por unidad).
    const ckey = u.categoriaId == null ? 'null' : String(u.categoriaId)
    const ce = catMap.get(ckey) ?? { id: u.categoriaId, nombre: u.categoriaNombre ?? 'Sin categoría', total_ars: 0 }
    ce.total_ars += u.monto
    catMap.set(ckey, ce)

    // Etiquetas: cobertura (monto completo a cada una; sin etiquetas → "Sin etiqueta").
    if (u.etiquetas.length === 0) {
      const ex = etiqMap.get('null') ?? { id: null, nombre: 'Sin etiqueta', total_ars: 0 }
      ex.total_ars += u.monto
      etiqMap.set('null', ex)
    } else {
      for (const e of u.etiquetas) {
        const key = String(e.id)
        const ex = etiqMap.get(key) ?? { id: e.id, nombre: e.nombre, total_ars: 0 }
        ex.total_ars += u.monto
        etiqMap.set(key, ex)
      }
    }

    const cce = conMap.get(u.conceptoId) ?? { concepto_id: u.conceptoId, nombre: u.conceptoNombre, total_ars: 0 }
    cce.total_ars += u.monto
    conMap.set(u.conceptoId, cce)

    const tkey = u.tarjetaId == null ? 'null' : String(u.tarjetaId)
    const te = tarjMap.get(tkey) ?? { id: u.tarjetaId, nombre: u.tarjetaNombre ?? 'Sin tarjeta', total_ars: 0 }
    te.total_ars += u.monto
    tarjMap.set(tkey, te)

    // Casa: partición (una por gasto). Es un corte que sólo estaba como filtro.
    const casakey = u.casaId == null ? 'null' : String(u.casaId)
    const casae = casaMap.get(casakey) ?? { id: u.casaId, nombre: u.casaNombre ?? 'Sin casa', total_ars: 0 }
    casae.total_ars += u.monto
    casaMap.set(casakey, casae)

    if (u.tipoPago) {
      const pe = tipoMap.get(u.tipoPago) ?? { tipo: u.tipoPago, nombre: TIPO_PAGO_NOMBRE[u.tipoPago], total_ars: 0 }
      pe.total_ars += u.monto
      tipoMap.set(u.tipoPago, pe)
    }
  }

  const por_mes = months.map(({ mes, anio }) => {
    const b = mesMap.get(`${anio}-${mes}`)!
    return { ...b, total_ars: r(b.total_ars) }
  })
  const sortByTotalDesc = (m: Map<string, CategoriaBucket>) =>
    Array.from(m.values()).map((c) => ({ ...c, total_ars: r(c.total_ars) })).sort((a, b) => b.total_ars - a.total_ars)
  const por_categoria = sortByTotalDesc(catMap)
  const por_etiqueta = sortByTotalDesc(etiqMap)
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
  const por_casa = Array.from(casaMap.values())
    .map((c) => ({ ...c, total_ars: r(c.total_ars) }))
    .sort((a, b) => b.total_ars - a.total_ars)

  const meses = months.length
  const totalPrevio = opts.totalPrevio ?? null
  return {
    kpis: {
      total: r(total),
      promedio_mensual: r(meses ? total / meses : 0),
      cantidad_gastos: cantidadGastos,
      meses,
      total_previo: totalPrevio === null ? null : r(totalPrevio),
      variacion_pct: totalPrevio === null || totalPrevio === 0
        ? null
        : r(((total - totalPrevio) / Math.abs(totalPrevio)) * 100),
    },
    por_categoria,
    por_etiqueta,
    por_mes,
    top_conceptos,
    por_tarjeta,
    por_tipo_pago,
    por_casa,
  }
}

/** Reporte a nivel gasto (cada gasto cuenta una vez con su total). */
export function computeReportes(
  gastos: any[],
  months: { mes: number; anio: number }[],
  opts: AggregateOpts = {},
): ReporteResult {
  return aggregateUnits(gastosToUnits(gastos), months, gastos.length, opts)
}

/**
 * Reporte desglosado por sub-item (con fallback al nivel gasto si no hay sub-items).
 * `opts.filtros` filtra a nivel sub-ítem (ver `filterUnits`): la route no puede hacerlo
 * en el `where`, que sólo alcanza al gasto. El KPI `cantidad_gastos` cuenta los gastos
 * distintos que quedaron con al menos una unidad.
 */
export function computeReporteSubitems(
  gastos: any[],
  months: { mes: number; anio: number }[],
  opts: AggregateOpts & { filtros?: UnitFilters } = {},
): ReporteResult {
  const units = filterUnits(gastosToSubitemUnits(gastos), opts.filtros)
  const cantidadGastos = new Set(units.map((u) => u.gastoIndex)).size
  return aggregateUnits(units, months, cantidadGastos, opts)
}
