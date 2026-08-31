// Presupuesto mensual por categoría: validación del body, mapping de la respuesta y el
// cruce contra lo realmente gastado. Puro (sin Prisma/Next) para poder testear el cálculo,
// que es donde se decide si algo se muestra en rojo o no.

/** Umbral a partir del cual el consumo se marca como "cerca" del tope (90%). */
export const UMBRAL_CERCA = 90

export type EstadoPresupuesto = 'ok' | 'cerca' | 'excedido'

export interface PresupuestoBody {
  categoriaId: number
  mes: number
  anio: number
  monto: number
}

/**
 * Valida el body de `POST /api/presupuestos`. Devuelve `null` si es inválido, para que la
 * route responda 400 sin tocar la DB.
 *
 * El monto admite 0 (que significa "en esta categoría no se gasta nada" y cualquier gasto
 * lo excede) pero **no negativos**: un tope negativo no representa nada.
 */
export function parsePresupuestoBody(body: any): PresupuestoBody | null {
  const categoriaId = Number(body?.categoria_id)
  const mes = Number(body?.mes)
  const anio = Number(body?.anio)
  const monto = Number(body?.monto)

  if (!Number.isInteger(categoriaId) || categoriaId <= 0) return null
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return null
  if (!Number.isInteger(anio) || anio < 1900 || anio > 2999) return null
  if (!Number.isFinite(monto) || monto < 0) return null

  return { categoriaId, mes, anio, monto }
}

/** Mapping camelCase→snake_case de una fila de Prisma (con `categoria` incluida). */
export function toPresupuestoResponse(row: any) {
  return {
    id: row.id,
    categoria_id: row.categoriaId,
    categoria_nombre: row.categoria?.nombre ?? null,
    mes: row.mes,
    anio: row.anio,
    monto: row.monto,
    // El tope que el reparto automático no toca: gasto fijo marcado, o ajustado a mano.
    fijado: !!row.fijado,
  }
}

export interface EjecucionPresupuesto {
  categoria_id: number
  categoria_nombre: string
  /** Tope cargado. `null` cuando la categoría no tiene presupuesto para el período. */
  monto: number | null
  /** Lo efectivamente gastado en la categoría durante el período. */
  gastado: number
  /** `monto − gastado`. Negativo = excedido. `null` sin presupuesto. */
  restante: number | null
  /**
   * `gastado / monto × 100`. `null` sin presupuesto. Con presupuesto en 0 y algo gastado
   * es `Infinity`-free: se devuelve `null` y el estado ya dice "excedido".
   */
  consumido_pct: number | null
  estado: EstadoPresupuesto
}

export interface CategoriaGasto {
  id: number | null
  nombre: string
  total_ars: number
}

export interface PresupuestoRow {
  categoria_id: number
  categoria_nombre: string | null
  monto: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Cruza los presupuestos del período con lo gastado por categoría.
 *
 * Devuelve una fila por **cada categoría que tenga presupuesto o gasto**: las que sólo
 * tienen gasto aparecen con `monto: null` (sin presupuesto), porque esconderlas daría la
 * impresión de que todo el gasto del mes está presupuestado cuando no lo está.
 *
 * `gastos` viene con la categoría `id: null` para "Sin categoría"; esa fila se ignora — no
 * es una categoría a la que se le pueda poner un tope.
 *
 * Orden: primero los excedidos, después los que están cerca, después el resto; dentro de
 * cada grupo, mayor consumo primero. Lo que requiere atención queda arriba.
 */
export function computeEjecucion(
  presupuestos: PresupuestoRow[],
  gastos: CategoriaGasto[],
): EjecucionPresupuesto[] {
  const gastoPorCat = new Map<number, CategoriaGasto>()
  for (const g of gastos ?? []) {
    if (g.id != null) gastoPorCat.set(g.id, g)
  }

  const filas = new Map<number, EjecucionPresupuesto>()

  for (const p of presupuestos ?? []) {
    const gastado = r2(gastoPorCat.get(p.categoria_id)?.total_ars ?? 0)
    filas.set(p.categoria_id, {
      categoria_id: p.categoria_id,
      categoria_nombre: p.categoria_nombre ?? gastoPorCat.get(p.categoria_id)?.nombre ?? '—',
      monto: p.monto,
      gastado,
      restante: r2(p.monto - gastado),
      consumido_pct: p.monto > 0 ? r2((gastado / p.monto) * 100) : null,
      estado: estadoDe(p.monto, gastado),
    })
  }

  // Categorías con gasto pero sin presupuesto: se muestran igual.
  for (const [id, g] of gastoPorCat) {
    if (filas.has(id)) continue
    filas.set(id, {
      categoria_id: id,
      categoria_nombre: g.nombre,
      monto: null,
      gastado: r2(g.total_ars),
      restante: null,
      consumido_pct: null,
      estado: 'ok',
    })
  }

  const peso: Record<EstadoPresupuesto, number> = { excedido: 0, cerca: 1, ok: 2 }
  return Array.from(filas.values()).sort((a, b) => {
    if (peso[a.estado] !== peso[b.estado]) return peso[a.estado] - peso[b.estado]
    return (b.consumido_pct ?? -1) - (a.consumido_pct ?? -1)
  })
}

function estadoDe(monto: number, gastado: number): EstadoPresupuesto {
  // Un tope en 0 lo excede cualquier gasto positivo; sin gasto sigue estando "ok".
  if (monto === 0) return gastado > 0 ? 'excedido' : 'ok'
  const pct = (gastado / monto) * 100
  if (pct > 100) return 'excedido'
  if (pct >= UMBRAL_CERCA) return 'cerca'
  return 'ok'
}

export interface TotalesPresupuesto {
  /** Suma de los topes cargados. */
  presupuestado: number
  /** Lo gastado **en categorías con presupuesto** — lo comparable contra el total. */
  gastado: number
  /** Lo gastado en categorías sin presupuesto, que queda fuera de la comparación. */
  sin_presupuesto: number
  restante: number
  consumido_pct: number | null
  excedidas: number
}

/**
 * Totales de la pantalla. `gastado` cuenta **sólo** las categorías con presupuesto: sumarle
 * lo no presupuestado haría que el total se pase del tope aunque cada categoría con
 * presupuesto esté dentro. Lo no presupuestado se informa aparte para que no desaparezca.
 */
export function totalesPresupuesto(filas: EjecucionPresupuesto[]): TotalesPresupuesto {
  const conPresupuesto = filas.filter(f => f.monto !== null)
  const presupuestado = r2(conPresupuesto.reduce((s, f) => s + (f.monto ?? 0), 0))
  const gastado = r2(conPresupuesto.reduce((s, f) => s + f.gastado, 0))
  const sin_presupuesto = r2(filas.filter(f => f.monto === null).reduce((s, f) => s + f.gastado, 0))

  return {
    presupuestado,
    gastado,
    sin_presupuesto,
    restante: r2(presupuestado - gastado),
    consumido_pct: presupuestado > 0 ? r2((gastado / presupuestado) * 100) : null,
    excedidas: filas.filter(f => f.estado === 'excedido').length,
  }
}
