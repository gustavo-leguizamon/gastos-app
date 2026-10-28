// Promociones de reintegro: validación de los bodies, mapping de la respuesta y el cálculo
// de cuánto se consumió, cuánto se reintegró y cuánto falta para exprimir el tope del mes.
// Puro (sin Prisma/Next) para poder testearlo: es donde se decide "gastá $X más en este
// lugar" o "ya llegaste al tope", y un error acá es plata que se deja de recuperar.

import { mesAnioDeFecha } from './ingresos-compute'

/** Días de la semana, **lunes primero** (convención local): 0 = lunes … 6 = domingo. */
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Día de la semana (0 = lunes … 6 = domingo) de una fecha `YYYY-MM-DD`.
 *
 * Se parsea como string y se calcula en UTC: `new Date('2026-10-26')` se interpreta como
 * UTC y, leído con `getDay()` local, correría un día para timezones detrás de UTC.
 * `null` si la fecha no tiene el formato esperado.
 */
export function diaSemanaDeFecha(fecha: unknown): number | null {
  if (!mesAnioDeFecha(fecha)) return null
  const [y, m, d] = (fecha as string).split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = domingo
  return (dow + 6) % 7
}

export interface PromocionData {
  lugar: string
  conceptoId: number | null
  porcentaje: number
  topeMensual: number
  dias: number[]
  tarjetaIds: number[]
  efectivo: boolean
  activa: boolean
  notas: string | null
  vigenteDesde: string | null
  vigenteHasta: string | null
}

/** Fecha opcional `YYYY-MM-DD`: vacía → `null`, válida → la fecha, inválida → `false`. */
function parseFechaOpcional(v: unknown): string | null | false {
  if (v == null || v === '') return null
  return mesAnioDeFecha(v) ? (v as string) : false
}

/**
 * Valida y normaliza el body de alta/edición de una promoción (snake_case → camelCase).
 * Devuelve `null` si es inválido, para que la route responda 400 sin tocar la DB.
 *
 * Reglas: lugar no vacío; porcentaje en `(0, 100]`; tope mensual `> 0` (la cuenta de "cuánto
 * hay que gastar para llegar al tope" divide por el porcentaje y no tiene sentido sin tope);
 * al menos un día; al menos un medio de pago — una promo sin tarjetas ni efectivo no
 * aplicaría nunca; y, si hay vigencia, fechas válidas con `hasta >= desde`.
 */
export function parsePromocionBody(body: any): PromocionData | null {
  if (!body || typeof body !== 'object') return null

  const lugar = typeof body.lugar === 'string' ? body.lugar.trim().replace(/\s+/g, ' ') : ''
  if (!lugar) return null

  const porcentaje = Number(body.porcentaje)
  if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) return null

  const topeMensual = Number(body.tope_mensual)
  if (!Number.isFinite(topeMensual) || topeMensual <= 0) return null

  const diasRaw: unknown[] = Array.isArray(body.dias) ? body.dias : []
  const dias = Array.from(new Set(diasRaw.map(Number))).sort((a, b) => a - b)
  if (dias.length === 0 || dias.some(d => !Number.isInteger(d) || d < 0 || d > 6)) return null

  const tarjetasRaw: unknown[] = Array.isArray(body.tarjeta_ids) ? body.tarjeta_ids : []
  const tarjetaIds = Array.from(new Set(tarjetasRaw.map(Number)))
  if (tarjetaIds.some(id => !Number.isInteger(id) || id <= 0)) return null

  const efectivo = body.efectivo === true
  if (tarjetaIds.length === 0 && !efectivo) return null

  let conceptoId: number | null = null
  if (body.concepto_id != null && body.concepto_id !== '') {
    conceptoId = Number(body.concepto_id)
    if (!Number.isInteger(conceptoId) || conceptoId <= 0) return null
  }

  const notas = typeof body.notas === 'string' && body.notas.trim() ? body.notas.trim() : null

  const vigenteDesde = parseFechaOpcional(body.vigente_desde)
  const vigenteHasta = parseFechaOpcional(body.vigente_hasta)
  if (vigenteDesde === false || vigenteHasta === false) return null
  if (vigenteDesde && vigenteHasta && vigenteHasta < vigenteDesde) return null

  return {
    lugar,
    conceptoId,
    porcentaje: r2(porcentaje),
    topeMensual: r2(topeMensual),
    dias,
    tarjetaIds,
    efectivo,
    activa: body.activa !== false,
    notas,
    vigenteDesde,
    vigenteHasta,
  }
}

export interface PromocionUsoData {
  fecha: string
  mes: number
  anio: number
  montoGasto: number
  notas: string | null
}

/**
 * Valida el body de un uso manual. `mes`/`anio` se derivan de la `fecha` (string, ver
 * `mesAnioDeFecha`). El monto debe ser `> 0`: un uso negativo no es un consumo.
 */
export function parseUsoBody(body: any): PromocionUsoData | null {
  if (!body || typeof body !== 'object') return null
  const periodo = mesAnioDeFecha(body.fecha)
  if (!periodo) return null
  const montoGasto = Number(body.monto_gasto)
  if (!Number.isFinite(montoGasto) || montoGasto <= 0) return null
  const notas = typeof body.notas === 'string' && body.notas.trim() ? body.notas.trim() : null
  return { fecha: body.fecha, mes: periodo.mes, anio: periodo.anio, montoGasto: r2(montoGasto), notas }
}

/** Mapping camelCase→snake_case de una fila de Prisma (con `concepto` y `tarjetas` incluidos). */
export function toPromocionResponse(row: any) {
  const tarjetas: any[] = row.tarjetas ?? []
  return {
    id: row.id,
    lugar: row.lugar,
    concepto_id: row.conceptoId ?? null,
    concepto_nombre: row.concepto?.nombre ?? null,
    porcentaje: row.porcentaje,
    tope_mensual: row.topeMensual,
    dias: [...(row.dias ?? [])].sort((a: number, b: number) => a - b),
    tarjeta_ids: tarjetas.map(t => t.id),
    tarjetas: tarjetas.map(t => ({
      id: t.id,
      nombre: t.nombre,
      banco: t.banco ?? null,
      marca: t.marca ?? null,
      banco_logo: t.bancoLogo ?? null,
      banco_icono: t.bancoIcono ?? null,
    })),
    efectivo: !!row.efectivo,
    activa: row.activa !== false,
    notas: row.notas ?? null,
    vigente_desde: row.vigenteDesde ?? null,
    vigente_hasta: row.vigenteHasta ?? null,
  }
}

export function toUsoResponse(row: any) {
  return {
    id: row.id,
    promocion_id: row.promocionId,
    fecha: row.fecha,
    mes: row.mes,
    anio: row.anio,
    monto_gasto: row.montoGasto,
    notas: row.notas ?? null,
  }
}

// ── Consumo ──────────────────────────────────────────────────────────────────────────

export interface PromoMedios {
  tarjetaIds: number[]
  efectivo: boolean
}

/**
 * Si un medio de pago entra en la promo: una de sus tarjetas, o —si vale en efectivo— débito
 * **sin tarjeta**. Un débito con una tarjeta que no es de la promo no cuenta como efectivo.
 */
export function medioCoincide(
  promo: PromoMedios,
  medio: { tipoPago: string; tarjetaId: number | null },
): boolean {
  if (medio.tarjetaId != null && promo.tarjetaIds.includes(medio.tarjetaId)) return true
  return promo.efectivo && medio.tipoPago === 'D' && medio.tarjetaId == null
}

/**
 * Si la promo está vigente en algún día del mes `(mes, anio)`. Sin límite de un lado = abierta
 * de ese lado. Compara strings `YYYY-MM-DD` (orden lexicográfico = cronológico): el último día
 * del mes se toma como `-31`, válido para comparar aunque el mes tenga menos días.
 */
export function vigenteEnMes(
  promo: { vigenteDesde?: string | null; vigenteHasta?: string | null },
  mes: number,
  anio: number,
): boolean {
  const mm = String(mes).padStart(2, '0')
  const primero = `${anio}-${mm}-01`
  const ultimo = `${anio}-${mm}-31`
  if (promo.vigenteDesde && promo.vigenteDesde > ultimo) return false
  if (promo.vigenteHasta && promo.vigenteHasta < primero) return false
  return true
}

export interface GastoConsumo {
  promocionId: number | null
  totalMoneda: number
  tipoCambio: number
}

/**
 * Consumo del mes de una promo que sale **de los gastos asociados a ella** (`Gasto.promocionId`).
 *
 * La asociación es explícita a propósito: el gasto no guarda fecha de compra, así que no hay
 * forma de saber cuáles caen después de que la promo arrancó. Quien carga el gasto decide si
 * cuenta (el form lo sugiere por concepto y medio de pago). Los gastos del período ya vienen
 * filtrados por la route.
 *
 * Suma el total en ARS (`totalMoneda × tipoCambio`, igual que `total_ars`); las devoluciones
 * (negativos) restan.
 */
export function consumoAutomatico(promocionId: number, gastos: GastoConsumo[]): number {
  return r2(
    gastos.reduce((s, g) => (g.promocionId === promocionId ? s + g.totalMoneda * g.tipoCambio : s), 0),
  )
}

// ── Progreso del tope ────────────────────────────────────────────────────────────────

export type EstadoPromocion = 'sin_uso' | 'en_curso' | 'tope_alcanzado'

export interface ProgresoPromocion {
  consumo_auto: number
  consumo_manual: number
  consumo: number
  /** Gasto que hace falta en el mes para que el reintegro llegue justo al tope. */
  gasto_minimo: number
  /** Lo que falta gastar para llegar a `gasto_minimo` (0 si ya se llegó). */
  gasto_restante: number
  /** Reintegro ganado hasta ahora, **topeado**. */
  reintegrado: number
  /** Reintegro que todavía se puede ganar este mes (`tope − reintegrado`). */
  disponible: number
  /** Porcentaje del tope ya usado, recortado a `[0, 100]`. */
  pct_tope: number
  estado: EstadoPromocion
}

/**
 * Cuánto se reintegró y cuánto queda por aprovechar de una promo en un mes.
 *
 * - `reintegrado = min(consumo × % , tope)`: pasado el tope seguir gastando no devuelve más.
 * - `gasto_minimo = tope ÷ %`: el gasto **justo** que agota el tope. Gastar menos deja plata
 *   sobre la mesa; gastar más no suma. Es la cifra para decidir cuánto comprar.
 * - Un consumo negativo (más devoluciones que compras) se toma como 0: no hay reintegro
 *   negativo.
 */
export function progresoPromocion(
  promo: { porcentaje: number; topeMensual: number },
  consumoAuto: number,
  consumoManual: number,
): ProgresoPromocion {
  const consumo = r2(consumoAuto + consumoManual)
  const base = Math.max(0, consumo)
  const tasa = promo.porcentaje / 100
  const gastoMinimo = r2(promo.topeMensual / tasa)
  const reintegrado = r2(Math.min(base * tasa, promo.topeMensual))
  const disponible = r2(Math.max(0, promo.topeMensual - reintegrado))
  const alcanzado = base * tasa >= promo.topeMensual - 0.005

  return {
    consumo_auto: r2(consumoAuto),
    consumo_manual: r2(consumoManual),
    consumo,
    gasto_minimo: gastoMinimo,
    gasto_restante: alcanzado ? 0 : r2(Math.max(0, gastoMinimo - base)),
    reintegrado,
    disponible: alcanzado ? 0 : disponible,
    pct_tope: Math.min(100, Math.max(0, Math.round((reintegrado / promo.topeMensual) * 100))),
    estado: alcanzado ? 'tope_alcanzado' : base > 0 ? 'en_curso' : 'sin_uso',
  }
}

export interface TotalesPromociones {
  /** Suma de los topes de las promos activas: lo máximo que se puede recuperar en el mes. */
  tope_total: number
  reintegrado: number
  disponible: number
  /** Cuántas promos activas ya agotaron su tope. */
  completas: number
}

export function totalesPromociones(
  items: { activa: boolean; vigente?: boolean; tope_mensual: number; progreso: ProgresoPromocion }[],
): TotalesPromociones {
  const activas = items.filter(i => i.activa && i.vigente !== false)
  return {
    tope_total: r2(activas.reduce((s, i) => s + i.tope_mensual, 0)),
    reintegrado: r2(activas.reduce((s, i) => s + i.progreso.reintegrado, 0)),
    disponible: r2(activas.reduce((s, i) => s + i.progreso.disponible, 0)),
    completas: activas.filter(i => i.progreso.estado === 'tope_alcanzado').length,
  }
}

// ── Semana ───────────────────────────────────────────────────────────────────────────

/**
 * Las promos **activas y vigentes** que valen un día de la semana (0 = lunes … 6 = domingo).
 * `vigente` lo calcula la route para el período; ausente = vigente.
 */
export function promosDelDia<T extends { activa: boolean; vigente?: boolean; dias: number[] }>(promos: T[], dia: number): T[] {
  return promos.filter(p => p.activa && p.vigente !== false && p.dias.includes(dia))
}

/** La grilla semanal: siempre 7 columnas (lunes a domingo), con las promos de cada día. */
export function semanaPromos<T extends { activa: boolean; vigente?: boolean; dias: number[] }>(promos: T[]): { dia: number; promos: T[] }[] {
  return DIAS_SEMANA.map((_, dia) => ({ dia, promos: promosDelDia(promos, dia) }))
}

/**
 * Orden de las promos de un día: primero las que **todavía tienen tope por aprovechar**
 * (más plata disponible arriba), y al final las que ya lo agotaron — en "Hoy" lo útil es
 * saber dónde conviene gastar, no dónde ya no hay nada que ganar.
 */
export function ordenarPorDisponible<T extends { progreso: ProgresoPromocion }>(promos: T[]): T[] {
  return [...promos].sort((a, b) => {
    const aFin = a.progreso.estado === 'tope_alcanzado' ? 1 : 0
    const bFin = b.progreso.estado === 'tope_alcanzado' ? 1 : 0
    if (aFin !== bFin) return aFin - bFin
    return b.progreso.disponible - a.progreso.disponible
  })
}
