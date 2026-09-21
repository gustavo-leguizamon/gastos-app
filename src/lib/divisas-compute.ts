// Lógica pura de la sección Divisas: la tenencia de dólares y cuántos pesos costaron.
//
// Nada de esto se persiste. `OperacionDivisa` guarda sólo lo que el usuario tipea (fecha,
// tipo, cantidad, cotización, comisión) y la tenencia, el costo y el resultado salen de
// recorrer las operaciones en orden. Un saldo guardado se desincroniza del detalle que lo
// produjo en cuanto se corrige una operación vieja — el mismo motivo por el que `total_ars`
// del gasto tampoco es una columna.
//
// Sin imports de Prisma/Next: las routes traen las filas y delegan acá la validación del
// body y el mapping, y la página reusa los mismos cálculos sobre la respuesta de la API.

import type { CotizacionDivisa, OperacionDivisa } from './types'

/**
 * Qué representa la operación. El signo **no** se guarda en `cantidad` (que es siempre
 * positiva): un número negativo suelto no dice si fue una venta o la corrección de una
 * compra cargada de más.
 *
 * - `compra` — pesos → divisa. Suma tenencia y suma costo en ARS.
 * - `venta` — divisa → pesos. Resta tenencia, libera costo y **realiza** el resultado.
 * - `rendimiento` — divisa generada (interés, ganancia de una inversión, un cobro en USD).
 *   Suma tenencia **con costo 0**: no se compró con pesos, así que baja el costo promedio.
 *   Es lo que hace visible el beneficio de invertir.
 * - `egreso` — divisa que salió sin venderse (la gastaste, la transferiste afuera). Resta
 *   tenencia y su costo, sin pesos de por medio.
 */
export type TipoOperacionDivisa = 'compra' | 'venta' | 'rendimiento' | 'egreso'

/**
 * De qué lado se cobró la comisión. No es un detalle cosmético: el broker cobra en pesos en
 * la compra y en dólares en la venta o en cripto, y según cuál sea cambia **la cantidad de
 * dólares que quedó** o **los pesos que salieron**. Sin este dato ni la tenencia ni el costo
 * cierran contra el resumen de la cuenta.
 */
export type ComisionMoneda = 'ARS' | 'DIVISA'

export const TIPOS_OPERACION: TipoOperacionDivisa[] = ['compra', 'venta', 'rendimiento', 'egreso']

/** Los tipos que **suman** divisa a la tenencia. El resto la restan. */
const ENTRADAS = new Set<TipoOperacionDivisa>(['compra', 'rendimiento'])

// `-0` es un valor legítimo de JS pero ruido en la UI y en los tests (`Object.is(-0, 0)` es
// false): un `ars_neto` de cero que salió de negar una suma vacía se normaliza a 0.
const sinCeroNegativo = (n: number) => (n === 0 ? 0 : n)

/** Pesos: dos decimales, como el resto de la app. */
const r2 = (n: number) => sinCeroNegativo(Math.round(n * 100) / 100)
/**
 * Divisa: ocho decimales. No alcanza con dos — una tenencia en cripto se mueve en fracciones
 * mucho más chicas que un centavo y redondearla ahí inventaría o borraría saldo.
 */
const r8 = (n: number) => sinCeroNegativo(Math.round(n * 1e8) / 1e8)

export interface OperacionCalculada extends OperacionDivisa {
  /** Divisa que entró (+) o salió (−) de la tenencia, ya neta de la comisión en divisa. */
  divisa_neta: number
  /** Pesos que salieron (−) o entraron (+) de la cuenta, netos de la comisión en pesos. */
  ars_neto: number
  /**
   * Lo que realmente costó (o rindió) cada unidad, comisión incluida — el número que nadie
   * calcula a mano y que casi nunca coincide con la cotización pactada. `null` cuando no
   * hubo precio (un `rendimiento`, o un `egreso` sin cotización de referencia).
   */
  cotizacion_efectiva: number | null
  /** Costo en ARS que la operación agrega (+) o libera (−) de la tenencia. */
  costo_delta: number
  /**
   * Resultado **realizado** de la operación: los pesos obtenidos menos el costo de la divisa
   * entregada. Sólo en las que sacan divisa; `null` en las entradas y en un `egreso` sin
   * cotización (no hay contra qué medirlo).
   */
  resultado: number | null
  /** Corrida acumulada: la tenencia **después** de esta operación. */
  tenencia: number
  /** De esa tenencia, la que se compró con pesos. */
  tenencia_comprada: number
  /** De esa tenencia, la que se generó (rendimientos): entró sin costar pesos. */
  tenencia_ganada: number
  /** Pesos que siguen inmovilizados en la tenencia después de esta operación. */
  costo_acumulado: number
  /** `costo_acumulado / tenencia`. `null` sin tenencia. */
  costo_promedio: number | null
}

/**
 * Deriva la corrida de una lista de operaciones. **Espera orden cronológico ascendente**
 * (fecha asc, id asc como desempate), igual que `computeMovimientos` en inversiones: cada
 * fila se apoya en el estado que dejó la anterior.
 *
 * El costo se lleva por **promedio ponderado**, no FIFO. Responde directo la pregunta que
 * importa acá ("cuántos pesos me costaron los dólares que tengo") sin obligar a rastrear
 * lotes; FIFO sólo cambia el número cuando hay que declararlo ante AFIP.
 */
export function computeOperaciones(operaciones: OperacionDivisa[]): OperacionCalculada[] {
  let tenencia = 0
  let compradas = 0
  let ganadas = 0
  let costo = 0

  return (operaciones ?? []).map((op) => {
    const comision = Number.isFinite(op.comision) ? op.comision : 0
    const comisionArs = op.comision_moneda === 'DIVISA' ? 0 : comision
    const comisionDivisa = op.comision_moneda === 'DIVISA' ? comision : 0
    const cotizacion = op.cotizacion ?? null
    const promedioPrevio = tenencia > 0 ? costo / tenencia : 0

    let divisa_neta: number
    let ars_neto: number
    let costo_delta: number
    let resultado: number | null = null
    let cotizacion_efectiva: number | null = null

    if (ENTRADAS.has(op.tipo)) {
      // La comisión en divisa se descuenta de lo que efectivamente entró; la comisión en
      // pesos no toca la cantidad pero sí encarece cada unidad.
      const bruto = cotizacion == null ? 0 : op.cantidad * cotizacion
      divisa_neta = r8(op.cantidad - comisionDivisa)
      ars_neto = r2(-(bruto + comisionArs))
      costo_delta = r2(bruto + comisionArs)
      cotizacion_efectiva =
        cotizacion == null || divisa_neta === 0 ? null : r2((bruto + comisionArs) / divisa_neta)

      if (op.tipo === 'compra') compradas = r8(compradas + divisa_neta)
      else ganadas = r8(ganadas + divisa_neta)
      tenencia = r8(tenencia + divisa_neta)
      costo = r2(costo + costo_delta)
    } else {
      // La comisión en divisa sale **además** de lo vendido: de la tenencia se van las dos.
      const salida = r8(op.cantidad + comisionDivisa)
      const bruto = cotizacion == null ? 0 : op.cantidad * cotizacion
      divisa_neta = r8(-salida)
      ars_neto = op.tipo === 'venta' ? r2(bruto - comisionArs) : r2(-comisionArs)

      // Nunca se libera más costo del que hay acumulado: vender más de lo que figura cargado
      // es un dato inconsistente, y dejar el costo en negativo lo propagaría a todo lo que
      // sigue en vez de dejarlo a la vista en la tenencia negativa.
      const costoSalida = Math.min(r2(salida * promedioPrevio), Math.max(costo, 0))
      costo_delta = r2(-costoSalida)

      if (op.tipo === 'venta') {
        resultado = r2(ars_neto - costoSalida)
        cotizacion_efectiva = salida === 0 ? null : r2((bruto - comisionArs) / salida)
      } else if (cotizacion != null) {
        // Un egreso no deja pesos, pero si se anotó a cuánto cotizaba se puede decir cuánto
        // valía lo que salió. Sin cotización no hay con qué medirlo y queda en `null`.
        resultado = r2(salida * cotizacion - comisionArs - costoSalida)
        cotizacion_efectiva = cotizacion
      }

      // Los buckets se drenan **proporcionales al mix del momento**: si la tenencia es 90%
      // comprada y 10% ganada, una salida se lleva esa misma proporción. Es la única regla
      // que no obliga a elegir arbitrariamente de cuál de los dos sale, y es la consistente
      // con el costo promedio (que ya trata a todas las unidades como iguales).
      const previa = tenencia
      const drenar = Math.min(salida, Math.max(previa, 0))
      if (previa > 0) {
        const f = drenar / previa
        compradas = r8(compradas - compradas * f)
        ganadas = r8(ganadas - ganadas * f)
      }
      // El excedente (salida mayor que la tenencia) se carga entero a `compradas` para que
      // `compradas + ganadas === tenencia` siga valiendo incluso con datos inconsistentes.
      const exceso = r8(salida - drenar)
      if (exceso !== 0) compradas = r8(compradas - exceso)

      tenencia = r8(previa - salida)
      costo = r2(costo + costo_delta)
      // Sin tenencia no puede quedar costo: lo que sobre es residuo de redondeo.
      if (tenencia <= 0) costo = 0
    }

    return {
      ...op,
      divisa_neta,
      ars_neto,
      cotizacion_efectiva,
      costo_delta,
      resultado,
      tenencia,
      tenencia_comprada: compradas,
      tenencia_ganada: ganadas,
      costo_acumulado: costo,
      costo_promedio: tenencia > 0 ? r2(costo / tenencia) : null,
    }
  })
}

export interface ResumenDivisa {
  /** Divisa en mano hoy. */
  tenencia: number
  /** De esa tenencia, cuánta se compró con pesos. */
  tenencia_comprada: number
  /** De esa tenencia, cuánta se generó sin poner pesos (rendimientos). */
  tenencia_ganada: number
  /** `tenencia_ganada` sobre el total. `null` sin tenencia. */
  ganada_pct: number | null
  /** Pesos que siguen inmovilizados en la tenencia actual. */
  costo_total: number
  /** `costo_total / tenencia`: a cuánto "salió" en promedio cada unidad que queda. */
  costo_promedio: number | null
  /** Todo lo que salió de la cuenta comprando, comisiones incluidas (histórico). */
  ars_invertido: number
  /** Todo lo que entró vendiendo, neto de comisiones (histórico). */
  ars_recuperado: number
  /** Suma de los resultados de las operaciones que ya se cerraron. */
  resultado_realizado: number
  /** Comisiones pagadas, separadas por moneda: sumarlas sería sumar peras con manzanas. */
  comision_ars: number
  comision_divisa: number
  /** Cantidad de operaciones cargadas. */
  cantidad: number
  /** Cotización con la que se valúa. `null` si no hay ninguna cargada. */
  cotizacion_actual: number | null
  /** `tenencia × cotizacion_actual`. `null` sin cotización. */
  valor_actual: number | null
  /** Lo que ganarías (o perderías) si vendieras todo hoy. `null` sin cotización. */
  resultado_no_realizado: number | null
  /** Realizado + no realizado: el resultado de toda la operatoria. `null` sin cotización. */
  resultado_total: number | null
  /**
   * `resultado_no_realizado` sobre `costo_total`: cómo viene **lo que tenés hoy**. No incluye
   * lo ya realizado a propósito — mezclarlo daría un porcentaje sobre una base que ya no
   * existe. `null` sin cotización o sin costo (una tenencia 100% ganada no costó nada y no
   * tiene porcentaje que calcular).
   */
  resultado_pct: number | null
}

/**
 * Estado de la posición. `cotizacionActual` es ARS por unidad y se pasa desde afuera (la
 * última `CotizacionDivisa` cargada, o la que el usuario tipee): el módulo no sabe de dónde
 * sale el precio, sólo qué hacer con él.
 */
export function resumenDivisa(
  operaciones: OperacionDivisa[],
  cotizacionActual: number | null = null,
): ResumenDivisa {
  const calc = computeOperaciones(operaciones)
  const ultima = calc[calc.length - 1]

  const tenencia = ultima?.tenencia ?? 0
  const costo_total = ultima?.costo_acumulado ?? 0

  let ars_invertido = 0
  let ars_recuperado = 0
  let resultado_realizado = 0
  let comision_ars = 0
  let comision_divisa = 0

  for (const op of calc) {
    if (op.tipo === 'compra') ars_invertido += -op.ars_neto
    if (op.tipo === 'venta') ars_recuperado += op.ars_neto
    resultado_realizado += op.resultado ?? 0
    if (op.comision_moneda === 'DIVISA') comision_divisa += op.comision
    else comision_ars += op.comision
  }

  const cot = cotizacionActual != null && Number.isFinite(cotizacionActual) ? cotizacionActual : null
  const valor_actual = cot == null ? null : r2(tenencia * cot)
  const resultado_no_realizado = valor_actual == null ? null : r2(valor_actual - costo_total)

  return {
    tenencia,
    tenencia_comprada: ultima?.tenencia_comprada ?? 0,
    tenencia_ganada: ultima?.tenencia_ganada ?? 0,
    ganada_pct: tenencia > 0 ? r2(((ultima?.tenencia_ganada ?? 0) / tenencia) * 100) : null,
    costo_total,
    costo_promedio: ultima?.costo_promedio ?? null,
    ars_invertido: r2(ars_invertido),
    ars_recuperado: r2(ars_recuperado),
    resultado_realizado: r2(resultado_realizado),
    comision_ars: r2(comision_ars),
    comision_divisa: r8(comision_divisa),
    cantidad: calc.length,
    cotizacion_actual: cot,
    valor_actual,
    resultado_no_realizado,
    resultado_total:
      resultado_no_realizado == null ? null : r2(resultado_realizado + resultado_no_realizado),
    resultado_pct:
      resultado_no_realizado == null || costo_total <= 0
        ? null
        : r2((resultado_no_realizado / costo_total) * 100),
  }
}

/**
 * La cotización vigente a una fecha: la última cargada **en o antes** de esa fecha. Sin
 * `hasta` devuelve la última de todas. `null` si no hay ninguna que aplique — el valor de la
 * posición queda sin calcular en vez de usar una cotización posterior a la fecha pedida, que
 * mostraría un valor que en ese momento no existía.
 */
export function cotizacionVigente(
  cotizaciones: CotizacionDivisa[],
  hasta?: string,
): CotizacionDivisa | null {
  let mejor: CotizacionDivisa | null = null
  for (const c of cotizaciones ?? []) {
    if (hasta != null && c.fecha > hasta) continue
    if (mejor === null || c.fecha > mejor.fecha) mejor = c
  }
  return mejor
}

export interface PuntoDivisa {
  fecha: string
  tenencia: number
  /** Pesos inmovilizados en la tenencia a esa fecha. */
  costo: number
  /** `tenencia × cotización vigente a esa fecha`. `null` si todavía no había cotización. */
  valor: number | null
}

/**
 * Serie para el gráfico: **costo contra valor**, que es donde se ve la ganancia. Una sola de
 * las dos curvas no dice nada — la tenencia en dólares es plana aunque el tipo de cambio se
 * duplique, y el valor en pesos sube aunque sólo estés comprando más.
 *
 * Los puntos son la unión de las fechas de operaciones y de cotizaciones, porque las dos
 * mueven alguna de las curvas: una compra cambia el costo, una cotización nueva el valor.
 * Las dos listas se esperan en orden cronológico ascendente.
 */
export function serieValorizada(
  operaciones: OperacionDivisa[],
  cotizaciones: CotizacionDivisa[],
): PuntoDivisa[] {
  const calc = computeOperaciones(operaciones)
  const cots = [...(cotizaciones ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha))

  const fechas = Array.from(
    new Set([...calc.map((o) => o.fecha), ...cots.map((c) => c.fecha)]),
  ).sort((a, b) => a.localeCompare(b))

  let iOp = 0
  let iCot = 0
  let tenencia = 0
  let costo = 0
  let cot: number | null = null

  return fechas.map((fecha) => {
    // El estado del día es el que dejó la **última** operación de esa fecha.
    while (iOp < calc.length && calc[iOp].fecha <= fecha) {
      tenencia = calc[iOp].tenencia
      costo = calc[iOp].costo_acumulado
      iOp++
    }
    while (iCot < cots.length && cots[iCot].fecha <= fecha) {
      cot = cots[iCot].valor
      iCot++
    }
    return { fecha, tenencia, costo, valor: cot == null ? null : r2(tenencia * cot) }
  })
}

// ---------------------------------------------------------------------------
// Validación y mapping de las routes. Viven acá y no en los `route.ts` porque Next rechaza
// en build cualquier export de un `route.ts` que no sea un método HTTP, y las routes de
// colección y de `[id]` necesitan los mismos helpers.
// ---------------------------------------------------------------------------

/**
 * `YYYY-MM-DD` con rangos plausibles. Se valida como string y nunca con `new Date()`, que
 * interpretaría el valor como UTC y correría el día para timezones detrás de UTC.
 */
const FECHA_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function esFecha(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false
  const m = FECHA_RE.exec(valor)
  if (!m) return false
  const mes = Number(m[2])
  const dia = Number(m[3])
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31
}

function texto(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const t = valor.trim()
  return t === '' ? null : t
}

/** Body de alta/edición de una operación, ya normalizado al camelCase que espera Prisma. */
export interface OperacionDivisaData {
  fecha: string
  tipo: TipoOperacionDivisa
  monedaId: number
  cantidad: number
  cotizacion: number | null
  comision: number
  comisionMoneda: ComisionMoneda
  plataforma: string | null
  descripcion: string | null
}

/**
 * Valida y normaliza el body (snake_case) de `/api/divisas/operaciones`. Devuelve `null` si
 * algo no cierra — la route responde 400 sin tocar la DB.
 *
 * Los pisos que se sostienen:
 * - `cantidad > 0` — la dirección la da `tipo`, no el signo (ver `TipoOperacionDivisa`).
 * - `cotizacion` **obligatoria y > 0** en `compra` y `venta`: sin precio no hay costo que
 *   calcular y la operación no serviría para nada. Opcional en `rendimiento` (no se compró)
 *   y en `egreso` (puede no saberse a cuánto estaba).
 * - `comision >= 0` — una comisión negativa sería una bonificación, que no es esto.
 */
export function parseOperacionBody(body: any): OperacionDivisaData | null {
  if (!body || typeof body !== 'object') return null
  if (!esFecha(body.fecha)) return null

  const tipo = body.tipo as TipoOperacionDivisa
  if (!TIPOS_OPERACION.includes(tipo)) return null

  const monedaId = Number(body.moneda_id)
  if (!Number.isInteger(monedaId) || monedaId <= 0) return null

  const cantidad = Number(body.cantidad)
  if (!Number.isFinite(cantidad) || cantidad <= 0) return null

  const requiereCotizacion = tipo === 'compra' || tipo === 'venta'
  let cotizacion: number | null = null
  if (body.cotizacion != null && body.cotizacion !== '') {
    const n = Number(body.cotizacion)
    if (!Number.isFinite(n) || n <= 0) return null
    cotizacion = n
  }
  if (requiereCotizacion && cotizacion === null) return null

  const comision = body.comision == null || body.comision === '' ? 0 : Number(body.comision)
  if (!Number.isFinite(comision) || comision < 0) return null

  const comisionMoneda: ComisionMoneda = body.comision_moneda === 'DIVISA' ? 'DIVISA' : 'ARS'

  return {
    fecha: body.fecha,
    tipo,
    monedaId,
    cantidad,
    cotizacion,
    comision,
    comisionMoneda,
    plataforma: texto(body.plataforma),
    descripcion: texto(body.descripcion),
  }
}

/** Mapping camelCase (Prisma) → snake_case (API) de una operación. */
export function toOperacionResponse(row: any): OperacionDivisa {
  return {
    id: row.id,
    fecha: row.fecha,
    tipo: row.tipo,
    moneda_id: row.monedaId,
    moneda_codigo: row.moneda?.codigo ?? null,
    moneda_simbolo: row.moneda?.simbolo ?? null,
    cantidad: row.cantidad,
    cotizacion: row.cotizacion ?? null,
    comision: row.comision,
    comision_moneda: row.comisionMoneda === 'DIVISA' ? 'DIVISA' : 'ARS',
    plataforma: row.plataforma ?? null,
    descripcion: row.descripcion ?? null,
    created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updated_at: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  }
}

export interface CotizacionDivisaData {
  monedaId: number
  fecha: string
  valor: number
  fuente: string | null
}

/** Valida y normaliza el body de `/api/divisas/cotizaciones`. `null` ⇒ 400. */
export function parseCotizacionBody(body: any): CotizacionDivisaData | null {
  if (!body || typeof body !== 'object') return null
  if (!esFecha(body.fecha)) return null

  const monedaId = Number(body.moneda_id)
  if (!Number.isInteger(monedaId) || monedaId <= 0) return null

  const valor = Number(body.valor)
  if (!Number.isFinite(valor) || valor <= 0) return null

  return { monedaId, fecha: body.fecha, valor, fuente: texto(body.fuente) }
}

/** Mapping camelCase (Prisma) → snake_case (API) de una cotización. */
export function toCotizacionResponse(row: any): CotizacionDivisa {
  return {
    id: row.id,
    moneda_id: row.monedaId,
    fecha: row.fecha,
    valor: row.valor,
    fuente: row.fuente ?? null,
  }
}
