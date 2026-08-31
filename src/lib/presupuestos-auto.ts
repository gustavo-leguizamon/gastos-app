/**
 * Generación automática de presupuestos a partir de un **objetivo de ahorro**.
 *
 * La pregunta que responde: "quiero que este mes me sobren $X — ¿cuánto puedo gastar en cada
 * categoría?". Antes los topes se cargaban uno por uno a ojo y nada ataba su suma a una meta.
 *
 * El reparto tiene dos momentos, y los dos viven acá porque son la misma aritmética:
 *
 * 1. **Generar** (`distribuirPresupuestos`): se escala el promedio histórico de cada categoría
 *    para que la suma entre en `ingresos − objetivo`.
 * 2. **Reajustar** (`reajustar`): al subir un tope a mano, la diferencia se saca de los demás
 *    para que el objetivo siga cumpliéndose — que es lo que hace utilizable la propuesta.
 *
 * Puro (sin Prisma/Next): acá se decide cuánta plata puede gastar el usuario en cada rubro, y
 * es exactamente el tipo de cálculo que puede romperse en silencio. Test:
 * `presupuestos-auto.test.ts`.
 */

import type { CategoriaBucket } from './reportes-compute'
import type { BasePresupuesto } from './presupuestos-base'

/** Meses hacia atrás promediados por defecto. */
export const MESES_HISTORICO_DEFAULT = 3

/** Tolerancia de comparación de montos (medio centavo), igual que en `subitems-total`. */
const EPSILON = 0.005

/** Corte del reparto iterativo: sólo actúa si algo patológico impide converger. */
const MAX_ITER = 50

const r2 = (n: number) => Math.round(n * 100) / 100

export type EstadoObjetivo = 'ok' | 'holgado' | 'imposible'

export interface PromedioCategoria {
  categoria_id: number
  categoria_nombre: string
  promedio: number
}

export interface FilaPropuesta {
  categoria_id: number
  categoria_nombre: string
  /** Promedio histórico, para poder mostrar cuánto se recortó. */
  promedio: number
  /** Tope propuesto. */
  monto: number
  /** No participa del reparto: gasto fijo marcado, o ajustado a mano. */
  fijado: boolean
}

export interface Propuesta {
  estado: EstadoObjetivo
  /** Lo que se puede gastar en el mes: `ingresos − objetivo`. */
  disponible: number
  filas: FilaPropuesta[]
  /** Suma de los topes propuestos. */
  asignado: number
  /**
   * `disponible − asignado`. Positivo = con los promedios se ahorraría **más** que el
   * objetivo; ese excedente queda como colchón en vez de inflarse en los topes.
   */
  colchon: number
  /** Sólo con estado `imposible`: cuánto se pasan los gastos fijos del disponible. */
  faltante: number
  /**
   * Factor aplicado a las categorías flexibles. 1 = no hizo falta recortar.
   * Nunca supera 1: ver `distribuirPresupuestos`.
   */
  factor: number
}

/**
 * Promedio de gasto por categoría sobre una ventana de meses.
 *
 * `meses` es un `por_categoria` por cada mes de la ventana (de `gastadoPorCategoria`, así el
 * promedio se calcula en la misma base contra la que después se va a medir la ejecución).
 *
 * `missingBehavior` replica la decisión que ya toma el estimado del próximo mes: un mes sin
 * gasto en la categoría cuenta como `0` (default, no sobreestima las categorías esporádicas)
 * o se ignora y sólo se promedian los meses en que hubo gasto (`average_found`).
 *
 * Se descartan dos cosas:
 * - La fila `id: null` ("Sin categoría"): no es una categoría a la que se le pueda poner tope
 *   (mismo criterio que `computeEjecucion`).
 * - Las categorías con promedio ≤ 0 (sin histórico, o con devoluciones que lo dejaron en
 *   negativo). Escalarlas daría un tope en 0, que **no** es lo mismo que no tener tope: diría
 *   "acá no se gasta nada" y cualquier gasto lo excedería. Quedan fuera de la propuesta y el
 *   usuario las agrega a mano si quiere.
 */
export function promediosPorCategoria(
  meses: CategoriaBucket[][],
  missingBehavior: 'zero' | 'average_found' = 'zero',
): PromedioCategoria[] {
  const cantidadMeses = (meses ?? []).length
  if (cantidadMeses === 0) return []

  const acumulado = new Map<number, { nombre: string; suma: number; meses: number }>()

  for (const mes of meses) {
    for (const c of mes ?? []) {
      if (c.id == null) continue
      const prev = acumulado.get(c.id) ?? { nombre: c.nombre, suma: 0, meses: 0 }
      prev.suma += c.total_ars
      prev.meses += 1
      // Si el nombre cambió entre meses gana el más reciente; da igual cuál, pero no puede
      // quedar vacío.
      if (c.nombre) prev.nombre = c.nombre
      acumulado.set(c.id, prev)
    }
  }

  const filas: PromedioCategoria[] = []
  for (const [id, a] of acumulado) {
    const divisor = missingBehavior === 'average_found' ? a.meses : cantidadMeses
    if (divisor === 0) continue
    const promedio = r2(a.suma / divisor)
    if (promedio <= 0) continue
    filas.push({ categoria_id: id, categoria_nombre: a.nombre, promedio })
  }

  return filas.sort((a, b) => b.promedio - a.promedio)
}

export interface DistribuirInput {
  /** Cuánto se quiere que sobre en el mes. */
  objetivo: number
  /** Ingresos esperados del mes. */
  ingresos: number
  promedios: PromedioCategoria[]
  /** Categorías que no se ajustan: se reservan a su promedio. */
  fijadas?: number[]
}

/**
 * Propuesta de topes: escala los promedios flexibles para que todo entre en `disponible`.
 *
 *     disponible = ingresos − objetivo
 *     factor     = (disponible − Σ fijas) / Σ flexibles
 *     tope_i     = promedio_i × factor        (flexible)
 *     tope_i     = promedio_i                 (fija)
 *
 * Tres decisiones sobre los bordes, que son donde una propuesta automática miente:
 *
 * - **El factor se capea en 1.** Si el objetivo es holgado, inflar los topes hasta consumir
 *   todo lo disponible convertiría el margen en permiso para gastar. Los topes se quedan en
 *   el promedio y el excedente se informa como `colchon`.
 * - **Si los gastos fijos solos se pasan del disponible, no se propone nada**: estado
 *   `imposible` con el `faltante`. Recortar lo fijo sería inventar que se puede dejar de
 *   pagar el alquiler.
 * - **Con recorte, la suma cierra exacta contra `disponible`**: el residuo del redondeo a
 *   centavos va a la fila flexible más grande. Si no, el objetivo quedaría desfasado por
 *   centavos y la pantalla mostraría un sobrante que no existe.
 */
export function distribuirPresupuestos(input: DistribuirInput): Propuesta {
  const disponible = r2(input.ingresos - input.objetivo)
  const fijadas = new Set(input.fijadas ?? [])

  const filas: FilaPropuesta[] = (input.promedios ?? []).map(p => ({
    categoria_id: p.categoria_id,
    categoria_nombre: p.categoria_nombre,
    promedio: p.promedio,
    monto: p.promedio,
    fijado: fijadas.has(p.categoria_id),
  }))

  const fijas = filas.filter(f => f.fijado)
  const flexibles = filas.filter(f => !f.fijado)
  const sumaFijas = suma(fijas.map(f => f.promedio))
  const sumaFlex = suma(flexibles.map(f => f.promedio))
  const paraFlexibles = r2(disponible - sumaFijas)

  // Lo fijo solo ya no entra: no hay reparto posible.
  if (paraFlexibles < -EPSILON) {
    for (const f of flexibles) f.monto = 0
    return {
      estado: 'imposible',
      disponible,
      filas,
      asignado: r2(sumaFijas),
      colchon: r2(disponible - sumaFijas),
      faltante: r2(-paraFlexibles),
      factor: 0,
    }
  }

  // Sin flexibles no hay nada que escalar: lo que sobre queda como colchón.
  if (sumaFlex <= 0) {
    const asignado = r2(sumaFijas)
    const colchon = r2(disponible - asignado)
    return {
      estado: colchon > EPSILON ? 'holgado' : 'ok',
      disponible,
      filas,
      asignado,
      colchon,
      faltante: 0,
      factor: 1,
    }
  }

  const factorCrudo = paraFlexibles / sumaFlex
  const factor = Math.min(1, factorCrudo)

  for (const f of flexibles) f.monto = r2(f.promedio * factor)

  // Con recorte la suma tiene que dar exacto: el redondeo a centavos se acomoda en la fila
  // flexible más grande, que es donde menos se nota.
  if (factor < 1) cerrarResiduo(flexibles, paraFlexibles)

  const asignado = r2(suma(filas.map(f => f.monto)))
  const colchon = r2(disponible - asignado)

  return {
    estado: colchon > EPSILON ? 'holgado' : 'ok',
    disponible,
    filas,
    asignado,
    colchon,
    faltante: 0,
    factor: r2(factor),
  }
}

/**
 * Mueve un tope a mano y compensa en las demás.
 *
 * La categoría tocada queda **fijada** (no se la vuelve a mover sola) y la diferencia se saca
 * —o se agrega— proporcionalmente entre las flexibles, de modo que **el total asignado no
 * cambia**: si el objetivo se cumplía antes, se sigue cumpliendo después, y si había colchón
 * se conserva igual.
 *
 * Tres cosas que hacen que el reajuste no mienta:
 *
 * - **El reparto es proporcional al monto actual**, que es lo que el usuario tiene en
 *   pantalla: las categorías que no tocó conservan su tamaño relativo entre sí.
 * - **Ninguna categoría baja de 0.** Un tope negativo no representa nada, así que el reparto
 *   se detiene en cero por más que falte compensar.
 * - **Si no hay quién absorba, se dice.** Lo que no se pudo compensar queda en `no_absorbido`
 *   (siempre ≥ 0) y el estado pasa a `imposible`, en vez de repartirse igual y mostrar un
 *   objetivo que ya no se cumple.
 */
export function reajustar(
  propuesta: Propuesta,
  categoriaId: number,
  nuevoMonto: number,
): Propuesta & { no_absorbido: number } {
  const filas = propuesta.filas.map(f => ({ ...f }))
  const objetivo = filas.find(f => f.categoria_id === categoriaId)

  if (!objetivo || !Number.isFinite(nuevoMonto)) {
    return { ...propuesta, filas, no_absorbido: 0 }
  }

  const monto = Math.max(0, r2(nuevoMonto))
  const delta = r2(monto - objetivo.monto)
  objetivo.monto = monto
  // Tocarla a mano la saca del reparto automático: si no, el propio reajuste la desharía.
  objetivo.fijado = true

  // Lo que se le dio a una hay que sacárselo a las otras (y viceversa).
  const flexibles = filas.filter(f => !f.fijado)
  const noAbsorbido = repartirEntre(flexibles, -delta)

  const totalFlexObjetivo = r2(suma(flexibles.map(f => f.monto)))
  cerrarResiduo(flexibles, totalFlexObjetivo)

  const asignado = r2(suma(filas.map(f => f.monto)))
  const colchon = r2(propuesta.disponible - asignado)

  return {
    ...propuesta,
    filas,
    asignado,
    colchon,
    estado: colchon < -EPSILON ? 'imposible' : colchon > EPSILON ? 'holgado' : 'ok',
    faltante: colchon < -EPSILON ? r2(-colchon) : 0,
    no_absorbido: r2(Math.abs(noAbsorbido)),
  }
}

/**
 * Reparte `delta` entre las filas, proporcional a su monto actual y con piso en 0. Devuelve
 * lo que **no** se pudo repartir, que sólo puede pasar sacando plata: como cada fila absorbe
 * su parte proporcional, todas tocan 0 a la vez, y ahí ya no queda de dónde.
 *
 * Con todos los montos en 0 el reparto proporcional no está definido, así que se reparte en
 * partes iguales — el caso de agregar plata a una propuesta que quedó toda en cero.
 */
function repartirEntre(filas: FilaPropuesta[], delta: number): number {
  let restante = delta

  for (let iter = 0; iter < MAX_ITER && Math.abs(restante) > EPSILON; iter++) {
    // Sacando plata sólo pueden absorber las que todavía tienen algo.
    const candidatas = filas.filter(f => restante > 0 || f.monto > 0)
    if (candidatas.length === 0) break

    const base = suma(candidatas.map(f => f.monto))
    let aplicado = 0
    for (const f of candidatas) {
      const parte = base > 0 ? f.monto / base : 1 / candidatas.length
      const nuevo = Math.max(0, f.monto + restante * parte)
      aplicado += nuevo - f.monto
      f.monto = nuevo
    }

    if (aplicado === 0) break
    restante -= aplicado
  }

  return Math.abs(restante) <= EPSILON ? 0 : restante
}

/**
 * Redondea a centavos y manda el residuo a la fila más grande, para que la suma dé
 * exactamente `total`. Repartir centavos entre todas acumularía deriva.
 */
function cerrarResiduo(filas: FilaPropuesta[], total: number) {
  if (filas.length === 0) return
  for (const f of filas) f.monto = r2(f.monto)

  const residuo = r2(total - suma(filas.map(f => f.monto)))
  if (residuo === 0) return

  const mayor = filas.reduce((a, b) => (b.monto > a.monto ? b : a), filas[0])
  mayor.monto = Math.max(0, r2(mayor.monto + residuo))
}

function suma(ns: number[]): number {
  return ns.reduce((s, n) => s + n, 0)
}

// ---------------------------------------------------------------------------
// Validación de los bodies del wizard
// ---------------------------------------------------------------------------

export interface GenerarBody {
  mes: number
  anio: number
  base: BasePresupuesto
  objetivo: number
  ingresosEsperados: number
  mesesHistorico: number
  fijadas: number[]
}

/** Ventana máxima de histórico que se puede promediar. */
const MAX_MESES_HISTORICO = 24

/**
 * Valida el body de `POST /api/presupuestos/generar`. `null` → 400 sin tocar la DB.
 *
 * `objetivo` admite 0 ("gastar todo lo que entra") pero no negativos: un objetivo de ahorro
 * negativo sería planificar déficit, y para eso alcanza con no usar el generador.
 * `ingresos_esperados` es obligatorio y no se deriva de los `Ingreso` cargados: al
 * presupuestar un mes que todavía no arrancó no hay ninguno (el default lo propone la
 * pantalla, que sí puede mirar el histórico).
 */
export function parseGenerarBody(body: any): GenerarBody | null {
  if (!body || typeof body !== 'object') return null

  const mes = Number(body.mes)
  const anio = Number(body.anio)
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return null
  if (!Number.isInteger(anio) || anio < 1900 || anio > 2999) return null

  // `Number(null)` es 0: sin este guard, un objetivo o unos ingresos que no vinieron se
  // colarían como "ahorrar 0" y "no entra plata" en vez de dar 400.
  if (body.objetivo == null || body.ingresos_esperados == null) return null

  const objetivo = Number(body.objetivo)
  if (!Number.isFinite(objetivo) || objetivo < 0) return null

  const ingresosEsperados = Number(body.ingresos_esperados)
  if (!Number.isFinite(ingresosEsperados) || ingresosEsperados < 0) return null

  const base = body.base === 'caja' ? 'caja' : 'devengado'

  const mesesHistorico = body.meses_historico == null
    ? MESES_HISTORICO_DEFAULT
    : Number(body.meses_historico)
  if (!Number.isInteger(mesesHistorico) || mesesHistorico < 1 || mesesHistorico > MAX_MESES_HISTORICO) return null

  const fijadas = parseIds(body.categorias_fijas)
  if (fijadas === null) return null

  return { mes, anio, base, objetivo, ingresosEsperados, mesesHistorico, fijadas }
}

export interface AplicarBody extends GenerarBody {
  filas: { categoriaId: number; monto: number; fijado: boolean }[]
}

/**
 * Valida el body de `POST /api/presupuestos/aplicar`: los mismos supuestos que `generar`
 * (se persisten con el objetivo para poder recalcular después) más los topes finales, que
 * son los que el usuario vio en pantalla — el server no los recalcula, porque volvería a
 * pisar los ajustes hechos a mano.
 *
 * Las filas se deduplican por categoría quedándose con la última: el payload lo arma el
 * cliente y una categoría repetida haría dos upserts sobre el mismo unique.
 */
export function parseAplicarBody(body: any): AplicarBody | null {
  const comun = parseGenerarBody(body)
  if (!comun) return null
  if (!Array.isArray(body.filas) || body.filas.length === 0) return null

  const porCategoria = new Map<number, { categoriaId: number; monto: number; fijado: boolean }>()
  for (const f of body.filas) {
    const categoriaId = Number(f?.categoria_id)
    const monto = Number(f?.monto)
    if (!Number.isInteger(categoriaId) || categoriaId <= 0) return null
    if (!Number.isFinite(monto) || monto < 0) return null
    porCategoria.set(categoriaId, { categoriaId, monto: r2(monto), fijado: !!f?.fijado })
  }

  return { ...comun, filas: Array.from(porCategoria.values()) }
}

/** Mapping camelCase (Prisma) → snake_case (API) del objetivo guardado. */
export function toObjetivoResponse(row: any) {
  return {
    id: row.id,
    mes: row.mes,
    anio: row.anio,
    monto: row.monto,
    ingresos_esperados: row.ingresosEsperados,
    base: (row.base === 'caja' ? 'caja' : 'devengado') as BasePresupuesto,
    meses_historico: row.mesesHistorico,
  }
}

/** Lista de ids enteros positivos, deduplicada. `null` si algún elemento no lo es. */
function parseIds(raw: any): number[] | null {
  if (raw == null) return []
  if (!Array.isArray(raw)) return null
  const out = new Set<number>()
  for (const v of raw) {
    const n = Number(v)
    if (!Number.isInteger(n) || n <= 0) return null
    out.add(n)
  }
  return Array.from(out)
}
