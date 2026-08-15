// Lógica pura de los ingresos mensuales. Sin imports de Prisma/Next para poder testearla
// aislada: las routes (`/api/ingresos`, `/api/resumen`) traen las filas y delegan acá la
// validación del body y los cálculos de total/ahorro.

/**
 * Un ingreso, en lo mínimo que necesitan los cálculos. Igual que en `Gasto`, el monto se
 * guarda en su moneda y se lleva a ARS con el tipo de cambio (que vale 1 si ya es ARS).
 */
export interface IngresoRow {
  montoMoneda: number
  tipoCambio: number
}

/** Body aceptado por POST/PUT `/api/ingresos`, ya normalizado a camelCase de Prisma. */
export interface IngresoData {
  fecha: string
  mes: number
  anio: number
  monedaId: number
  tipoCambio: number
  montoMoneda: number
  descripcion: string | null
  casaId: number | null
}

export interface AhorroResult {
  total_ingresos: number
  ahorro: number
  ahorro_pct: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Mes/año de una fecha `YYYY-MM-DD`, parseada como string — nunca con `new Date()`, que
 * interpretaría el string como UTC y correría el día (y con él el mes) para timezones
 * detrás de UTC. Devuelve `null` si la fecha no tiene el formato o los rangos esperados.
 */
export function mesAnioDeFecha(fecha: unknown): { mes: number; anio: number } | null {
  if (typeof fecha !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  if (!m) return null
  const anio = Number(m[1])
  const mes = Number(m[2])
  const dia = Number(m[3])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return { mes, anio }
}

/**
 * Valida y normaliza el body de alta/edición de un ingreso (snake_case) al shape camelCase
 * que espera Prisma. `mes`/`anio` se toman del body si vienen (permite imputar un cobro a
 * otro mes) y si no se derivan de `fecha`. Devuelve `null` si el body es inválido — la route
 * responde 400 sin tocar la DB.
 *
 * `monto_moneda` admite negativos a propósito: sirve para corregir un ingreso cargado de más
 * (ej. una devolución) sin tener que borrar y recargar. `tipo_cambio`, en cambio, tiene que
 * ser > 0 (mismo piso que en el gasto) y default 1 — el caso normal, un ingreso en ARS.
 */
export function parseIngresoBody(body: any): IngresoData | null {
  if (!body || typeof body !== 'object') return null

  const desdeFecha = mesAnioDeFecha(body.fecha)
  if (!desdeFecha) return null

  const montoMoneda = Number(body.monto_moneda)
  if (!Number.isFinite(montoMoneda)) return null

  const monedaId = Number(body.moneda_id)
  if (!Number.isInteger(monedaId) || monedaId <= 0) return null

  const tipoCambio = body.tipo_cambio == null ? 1 : Number(body.tipo_cambio)
  if (!Number.isFinite(tipoCambio) || tipoCambio <= 0) return null

  const mes = body.mes == null ? desdeFecha.mes : Number(body.mes)
  const anio = body.anio == null ? desdeFecha.anio : Number(body.anio)
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return null
  if (!Number.isInteger(anio) || anio < 1900 || anio > 3000) return null

  let casaId: number | null = null
  if (body.casa_id != null) {
    const n = Number(body.casa_id)
    if (!Number.isInteger(n) || n <= 0) return null
    casaId = n
  }

  const descripcionRaw = typeof body.descripcion === 'string' ? body.descripcion.trim() : ''

  return {
    fecha: body.fecha,
    mes,
    anio,
    monedaId,
    tipoCambio,
    montoMoneda,
    descripcion: descripcionRaw === '' ? null : descripcionRaw,
    casaId,
  }
}

/**
 * `where` de Prisma para los ingresos de un mes. Compartido por `/api/ingresos` y
 * `/api/resumen` para que la lista y la card no puedan mostrar totales distintos.
 *
 * Al filtrar por casa se incluyen además los ingresos **sin casa**: un cobro como el sueldo
 * no pertenece a una casa en particular y tiene que contar igual contra los gastos de la que
 * se esté mirando.
 */
export function buildIngresosWhere(
  mes: string | number | null,
  anio: string | number | null,
  casaId: string | number | null,
): Record<string, any> {
  const where: Record<string, any> = {}
  if (mes != null && mes !== '') where.mes = Number(mes)
  if (anio != null && anio !== '') where.anio = Number(anio)
  if (casaId != null && casaId !== '') where.OR = [{ casaId: Number(casaId) }, { casaId: null }]
  return where
}

/**
 * Mapping camelCase (Prisma) → snake_case (API), como el resto de las routes. Vive acá y no
 * en `ingresos/route.ts` porque Next rechaza en build cualquier export de un `route.ts` que
 * no sea un método HTTP, y la route de `[id]` necesita el mismo mapper.
 */
export function toIngresoResponse(i: any) {
  return {
    id: i.id,
    fecha: i.fecha,
    mes: i.mes,
    anio: i.anio,
    moneda_id: i.monedaId,
    moneda_codigo: i.moneda?.codigo ?? null,
    moneda_simbolo: i.moneda?.simbolo ?? null,
    tipo_cambio: i.tipoCambio,
    monto_moneda: i.montoMoneda,
    // Derivado, igual que `total_ars` en el gasto: nunca se persiste.
    monto_ars: montoArs(i),
    descripcion: i.descripcion ?? null,
    casa_id: i.casaId ?? null,
    casa_nombre: i.casa?.nombre ?? null,
    created_at: i.createdAt.toISOString(),
    updated_at: i.updatedAt.toISOString(),
  }
}

/** Monto del ingreso llevado a ARS. Con moneda ARS el tipo de cambio es 1 y no cambia nada. */
export function montoArs(i: IngresoRow): number {
  return r2(i.montoMoneda * i.tipoCambio)
}

/** Total de ingresos del mes, en ARS: la suma de todas las entradas cargadas. */
export function sumIngresos(ingresos: IngresoRow[]): number {
  return r2(ingresos.reduce((s, i) => s + i.montoMoneda * i.tipoCambio, 0))
}

/**
 * Misma suma, para las filas **ya mapeadas a la respuesta de la API**, que traen el monto
 * convertido en `monto_ars`. La usa el cliente (`useIngresos`), que nunca ve el shape
 * camelCase de Prisma; así el redondeo del total vive en un solo lugar.
 */
export function sumMontosArs(ingresos: { monto_ars: number }[]): number {
  return r2(ingresos.reduce((s, i) => s + i.monto_ars, 0))
}

/**
 * Ahorro del mes = ingresos − lo gastado en **débito/efectivo** (`totalDebito`), que es la
 * plata que sale de la cuenta: mide cuánta de la que entró sigue ahí. Los consumos de crédito
 * no restan acá — restan cuando se paga el resumen de la tarjeta, que se carga como débito.
 * `ahorro_pct` es esa proporción sobre los ingresos; sin ingresos cargados no hay porcentaje
 * que calcular y da 0.
 */
export function computeAhorro(ingresos: IngresoRow[], totalDebito: number): AhorroResult {
  const total = sumIngresos(ingresos)
  const ahorro = total - totalDebito
  return {
    total_ingresos: total,
    ahorro: r2(ahorro),
    ahorro_pct: total === 0 ? 0 : r2((ahorro / total) * 100),
  }
}
