/**
 * Proyección de cuotas de tarjeta comprometidas a futuro.
 *
 * Las compras en cuotas con crédito viven como sub-items de los resúmenes de tarjeta
 * (`Gasto.esTarjeta`), y la copia automática los arrastra de a un mes (cuota +1) recién
 * cuando pasa cada cierre. Esta proyección **no persiste nada**: toma las cuotas que ya
 * están cargadas y las extiende hasta la última, para ver cuánto queda comprometido en
 * cada mes que viene.
 *
 * Una misma compra aparece en varios resúmenes (la 3/6 en nov, la 4/6 copiada en dic). Se la
 * reconoce por tarjeta + casa + concepto + monto + cantidad de cuotas + **período de origen**
 * (el mes donde cayó la cuota 1 = período del resumen − (cuota − 1)), que es el mismo en
 * todas sus apariciones. Dos compras idénticas dentro de un mismo resumen son dos compras:
 * se cuenta la multiplicidad por resumen y entre resúmenes se toma la mayor.
 */

export type Periodo = { mes: number; anio: number }

/** Un sub-item con cuotas dentro de un resumen de tarjeta (período = el del resumen). */
export type CuotaFuente = {
  gasto_id: number
  tarjeta_id: number | null
  tarjeta: string
  casa_id: number
  concepto_id: number
  concepto: string
  monto: number
  cuota_actual: number
  cuotas_totales: number
  mes: number
  anio: number
}

/** Un resumen candidato (sólo lo necesario para elegir la base). */
export type ResumenRef = { id: number; tarjeta_id: number | null; casa_id: number; mes: number; anio: number }

export type CuotaMes = Periodo & { cuota: number }

export type CompraEnCuotas = {
  key: string
  tarjeta_id: number | null
  tarjeta: string
  concepto: string
  monto: number
  cuotas_totales: number
  /** Período de la cuota 1. */
  origen: Periodo
  /** Período de la última cuota. */
  ultima: Periodo
  /** Cuotas desde el mes consultado (inclusive) en adelante. */
  cuotas: CuotaMes[]
  /** monto × cuotas restantes (desde el mes consultado). */
  pendiente: number
}

export type MesProyectado = Periodo & { total: number; cantidad: number }

export type ProyeccionCuotas = {
  desde: Periodo
  meses: MesProyectado[]
  compras: CompraEnCuotas[]
  /** Todo lo que falta pagar desde el mes consultado (inclusive). */
  total_pendiente: number
  /** Lo que falta pagar desde el mes siguiente. */
  total_futuro: number
}

const idx = (p: Periodo) => p.anio * 12 + (p.mes - 1)
const dePeriodoIdx = (i: number): Periodo => ({ mes: (i % 12) + 1, anio: Math.floor(i / 12) })
const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Qué resúmenes mirar: por tarjeta y casa, el **último** con período ≤ al consultado (la base:
 * si el del mes todavía no se copió, sirve el anterior) más **todos** los posteriores (que
 * existen cuando un pago después del cierre ya creó el resumen siguiente). Los anteriores a la
 * base no van: si borraste una cuota en el mes, no tiene que resucitar desde el mes previo.
 */
export function seleccionarResumenes<T extends ResumenRef>(resumenes: T[], desde: Periodo): T[] {
  const ref = idx(desde)
  const base = new Map<string, number>()
  for (const r of resumenes) {
    const i = idx(r)
    if (i > ref) continue
    const k = `${r.tarjeta_id ?? 'x'}|${r.casa_id}`
    const prev = base.get(k)
    if (prev === undefined || i > prev) base.set(k, i)
  }
  return resumenes.filter(r => {
    const i = idx(r)
    if (i > ref) return true
    return base.get(`${r.tarjeta_id ?? 'x'}|${r.casa_id}`) === i
  })
}

/** Si un sub-item cuenta como cuota proyectable (datos coherentes y más de una cuota). */
export function esCuotaValida(f: Pick<CuotaFuente, 'cuota_actual' | 'cuotas_totales'>): boolean {
  return (
    Number.isInteger(f.cuota_actual) &&
    Number.isInteger(f.cuotas_totales) &&
    f.cuotas_totales > 1 &&
    f.cuota_actual >= 1 &&
    f.cuota_actual <= f.cuotas_totales
  )
}

export function proyectarCuotas(fuentes: CuotaFuente[], desde: Periodo): ProyeccionCuotas {
  const ref = idx(desde)

  // key → multiplicidad máxima entre resúmenes, más un representante para los datos.
  const porResumen = new Map<string, Map<number, number>>() // key → (gasto_id → cantidad)
  const repr = new Map<string, CuotaFuente & { origenIdx: number }>()

  for (const f of fuentes) {
    if (!esCuotaValida(f)) continue
    const origenIdx = idx(f) - (f.cuota_actual - 1)
    const key = [f.tarjeta_id ?? 'x', f.casa_id, f.concepto_id, round2(f.monto), f.cuotas_totales, origenIdx].join('|')
    const m = porResumen.get(key) ?? new Map<number, number>()
    m.set(f.gasto_id, (m.get(f.gasto_id) ?? 0) + 1)
    porResumen.set(key, m)
    if (!repr.has(key)) repr.set(key, { ...f, origenIdx })
  }

  const compras: CompraEnCuotas[] = []
  for (const [key, f] of Array.from(repr.entries())) {
    const ultimaIdx = f.origenIdx + f.cuotas_totales - 1
    if (ultimaIdx < ref) continue
    const cuotas: CuotaMes[] = []
    for (let i = Math.max(ref, f.origenIdx); i <= ultimaIdx; i++) {
      cuotas.push({ ...dePeriodoIdx(i), cuota: i - f.origenIdx + 1 })
    }
    const veces = Math.max(...Array.from(porResumen.get(key)!.values()))
    for (let v = 0; v < veces; v++) {
      compras.push({
        key: veces > 1 ? `${key}#${v + 1}` : key,
        tarjeta_id: f.tarjeta_id,
        tarjeta: f.tarjeta,
        concepto: f.concepto,
        monto: round2(f.monto),
        cuotas_totales: f.cuotas_totales,
        origen: dePeriodoIdx(f.origenIdx),
        ultima: dePeriodoIdx(ultimaIdx),
        cuotas,
        pendiente: round2(f.monto * cuotas.length),
      })
    }
  }

  // Lo que termina antes primero; a igual fin, por tarjeta y concepto.
  compras.sort(
    (a, b) =>
      idx(a.ultima) - idx(b.ultima) ||
      a.tarjeta.localeCompare(b.tarjeta, 'es') ||
      a.concepto.localeCompare(b.concepto, 'es', { sensitivity: 'base' }),
  )

  const meses: MesProyectado[] = []
  const finIdx = compras.reduce((max, c) => Math.max(max, idx(c.ultima)), ref - 1)
  for (let i = ref; i <= finIdx; i++) {
    const p = dePeriodoIdx(i)
    let total = 0
    let cantidad = 0
    for (const c of compras) {
      if (c.cuotas.some(q => q.mes === p.mes && q.anio === p.anio)) {
        total += c.monto
        cantidad++
      }
    }
    meses.push({ ...p, total: round2(total), cantidad })
  }

  const total_pendiente = round2(meses.reduce((s, m) => s + m.total, 0))
  const total_futuro = round2(meses.slice(1).reduce((s, m) => s + m.total, 0))

  return { desde, meses, compras, total_pendiente, total_futuro }
}
