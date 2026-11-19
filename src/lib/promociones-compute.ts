// Promociones de reintegro: validación de los bodies, mapping de la respuesta y el cálculo
// de cuánto se consumió, cuánto se reintegró y cuánto falta para exprimir el tope del mes.
// Puro (sin Prisma/Next) para poder testearlo: es donde se decide "gastá $X más en este
// lugar" o "ya llegaste al tope", y un error acá es plata que se deja de recuperar.

import { mesAnioDeFecha } from './ingresos-compute'
import { shiftMonth } from './fechas'

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

export const MODALIDADES = ['presencial', 'virtual', 'ambas'] as const
export type Modalidad = typeof MODALIDADES[number]

export type FiltroModalidad = 'todas' | 'presencial' | 'virtual'

/**
 * Filtro por modalidad de la página: `todas` no filtra; `presencial`/`virtual` dejan las promos de
 * esa modalidad **y** las `ambas` (valen en los dos lados). Una fila sin modalidad cuenta como `virtual`.
 */
export function coincideModalidad(promo: { modalidad?: string | null }, filtro: FiltroModalidad): boolean {
  if (filtro === 'todas') return true
  const m = promo.modalidad ?? 'virtual'
  return m === 'ambas' || m === filtro
}

export interface PromocionData {
  lugar: string
  conceptoIds: number[]
  categoriaIds: number[]
  etiquetaIds: number[]
  porcentaje: number
  topeMensual: number
  dias: number[]
  tarjetaIds: number[]
  efectivo: boolean
  modalidad: Modalidad
  activa: boolean
  notas: string | null
  vigenteDesde: string | null
  vigenteHasta: string | null
  diaReinicio: number
}

/** Lista opcional de ids (dedup). `null` si algún id no es un entero positivo. */
function parseIds(v: unknown): number[] | null {
  const raw: unknown[] = Array.isArray(v) ? v : []
  const ids = Array.from(new Set(raw.map(Number)))
  return ids.some(id => !Number.isInteger(id) || id <= 0) ? null : ids
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

  // Sin `modalidad` en el body = `virtual` (la más usada); un valor desconocido es inválido.
  const modalidad = body.modalidad == null || body.modalidad === '' ? 'virtual' : body.modalidad
  if (!MODALIDADES.includes(modalidad)) return null

  const conceptoIds = parseIds(body.concepto_ids)
  const categoriaIds = parseIds(body.categoria_ids)
  const etiquetaIds = parseIds(body.etiqueta_ids)
  if (!conceptoIds || !categoriaIds || !etiquetaIds) return null

  const notas = typeof body.notas === 'string' && body.notas.trim() ? body.notas.trim() : null

  const vigenteDesde = parseFechaOpcional(body.vigente_desde)
  const vigenteHasta = parseFechaOpcional(body.vigente_hasta)
  if (vigenteDesde === false || vigenteHasta === false) return null
  if (vigenteDesde && vigenteHasta && vigenteHasta < vigenteDesde) return null

  // Sin día de reinicio = 1 (mes calendario, lo más común).
  const diaReinicio = body.dia_reinicio == null || body.dia_reinicio === '' ? 1 : Number(body.dia_reinicio)
  if (!Number.isInteger(diaReinicio) || diaReinicio < 1 || diaReinicio > 31) return null

  return {
    lugar,
    conceptoIds,
    categoriaIds,
    etiquetaIds,
    porcentaje: r2(porcentaje),
    topeMensual: r2(topeMensual),
    dias,
    tarjetaIds,
    efectivo,
    modalidad,
    activa: body.activa !== false,
    notas,
    vigenteDesde,
    vigenteHasta,
    diaReinicio,
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

/** Mapping camelCase→snake_case de una fila de Prisma (con `conceptos`, `categorias`, `etiquetas` y `tarjetas` incluidos). */
export function toPromocionResponse(row: any) {
  const tarjetas: any[] = row.tarjetas ?? []
  const conceptos: any[] = row.conceptos ?? []
  const categorias: any[] = row.categorias ?? []
  const etiquetas: any[] = row.etiquetas ?? []
  return {
    id: row.id,
    lugar: row.lugar,
    concepto_ids: conceptos.map(c => c.id),
    concepto_nombres: conceptos.map(c => c.nombre),
    categoria_ids: categorias.map(c => c.id),
    categoria_nombres: categorias.map(c => c.nombre),
    etiqueta_ids: etiquetas.map(e => e.id),
    etiqueta_nombres: etiquetas.map(e => e.nombre),
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
    modalidad: MODALIDADES.includes(row.modalidad) ? row.modalidad : 'virtual',
    activa: row.activa !== false,
    notas: row.notas ?? null,
    vigente_desde: row.vigenteDesde ?? null,
    vigente_hasta: row.vigenteHasta ?? null,
    dia_reinicio: diaReinicioDe(row),
  }
}

/** Día de reinicio de una fila (camelCase); sin dato o inválido = 1. */
export function diaReinicioDe(row: { diaReinicio?: number | null }): number {
  const d = Number(row.diaReinicio)
  return Number.isInteger(d) && d >= 1 && d <= 31 ? d : 1
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

// ── Vencimiento del reintegro ────────────────────────────────────────────────────────

export interface ReintegroData {
  mes: number
  anio: number
  venceEl: string | null
  utilizado: boolean
}

/**
 * Valida el body del vencimiento de un reintegro (`mes`, `anio`, `vence_el` opcional,
 * `utilizado`). `vence_el` vacío = sin vencimiento. `null` si es inválido (la route responde 400).
 */
export function parseReintegroBody(body: any): ReintegroData | null {
  if (!body || typeof body !== 'object') return null
  const mes = Number(body.mes)
  const anio = Number(body.anio)
  if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio)) return null
  const venceEl = parseFechaOpcional(body.vence_el)
  if (venceEl === false) return null
  return { mes, anio, venceEl, utilizado: body.utilizado === true }
}

/** Fila de Prisma → `{ vence_el, utilizado }`; `null` si no hay nada cargado para ese mes. */
export function toReintegroResponse(row: any) {
  if (!row) return null
  return { vence_el: row.venceEl ?? null, utilizado: !!row.utilizado }
}

/**
 * Días de calendario desde `hoy` hasta `fecha` (ambas `YYYY-MM-DD`): `0` = vence hoy, negativo =
 * ya venció. Se calcula en UTC sobre el string (igual que `diaSemanaDeFecha`) para que el huso
 * horario no corra un día. `null` si alguna fecha es inválida.
 */
export function diasHasta(hoy: string, fecha: string): number | null {
  if (!mesAnioDeFecha(hoy) || !mesAnioDeFecha(fecha)) return null
  const t = (f: string) => {
    const [y, m, d] = f.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((t(fecha) - t(hoy)) / 86400000)
}

export type NivelVencimiento = 'vencido' | 'urgente' | 'proximo' | 'ok'

/** Hasta cuántos días antes del vencimiento es "urgente" (rojo) y "próximo" (naranja). */
export const DIAS_URGENTE = 7
export const DIAS_PROXIMO = 15

/**
 * Cuánto falta para que venza un reintegro y cómo mostrarlo: `vencido` (ya pasó), `urgente`
 * (≤ 7 días, incluye hoy), `proximo` (≤ 15) u `ok`. `null` sin fecha de vencimiento válida.
 */
export function estadoVencimiento(venceEl: string | null | undefined, hoy: string) {
  if (!venceEl) return null
  const dias = diasHasta(hoy, venceEl)
  if (dias == null) return null
  const nivel: NivelVencimiento =
    dias < 0 ? 'vencido' : dias <= DIAS_URGENTE ? 'urgente' : dias <= DIAS_PROXIMO ? 'proximo' : 'ok'
  return { dias, nivel }
}

// ── Saldo a favor (lo reintegrado, menos lo usado y lo vencido) ──────────────────────

/** Uso del saldo cargado a mano (`PromocionSaldoUso`). */
export interface PromocionSaldoUsoData {
  fecha: string
  monto: number
  notas: string | null
}

/** Valida el body de un uso del saldo: fecha válida y monto `> 0`. `null` si es inválido. */
export function parseSaldoUsoBody(body: any): PromocionSaldoUsoData | null {
  if (!body || typeof body !== 'object') return null
  if (!mesAnioDeFecha(body.fecha)) return null
  const monto = Number(body.monto)
  if (!Number.isFinite(monto) || monto <= 0) return null
  const notas = typeof body.notas === 'string' && body.notas.trim() ? body.notas.trim() : null
  return { fecha: body.fecha, monto: r2(monto), notas }
}

export function toSaldoUsoResponse(row: any) {
  return { id: row.id, promocion_id: row.promocionId, fecha: row.fecha, monto: row.monto, notas: row.notas ?? null }
}

/** Lo reintegrado en un ciclo: un "lote" de saldo con su propio vencimiento. */
export interface LoteReintegro {
  mes: number
  anio: number
  /** Inicio del ciclo: un uso del saldo anterior a esta fecha no puede consumir este lote. */
  desde: string
  monto: number
  vence_el: string | null
  /** Marcado a mano como usado entero ("Ya lo usé"). */
  utilizado: boolean
}

export interface GastoDeCiclo extends GastoConsumo {
  mes: number
  anio: number
  promocionFecha?: string | null
}

/**
 * Consumo de una promo en un ciclo: los gastos asociados que caen en ese ciclo (por su fecha de
 * compra, o por su mes si no la tienen) + los usos manuales cuya fecha cae en él.
 */
export function consumoEnCiclo(
  promo: { id: number; diaReinicio?: number | null },
  ciclo: { mes: number; anio: number },
  gastos: GastoDeCiclo[],
  usos: { fecha: string; montoGasto: number }[],
): { auto: number; manual: number } {
  const dia = diaReinicioDe(promo)
  const auto = consumoAutomatico(promo.id, gastos.filter(g => mismoCiclo(cicloDeGasto(g, dia), ciclo)))
  const manual = r2(usos.reduce((s, u) => {
    const c = cicloDeFecha(u.fecha, dia)
    return c && mismoCiclo(c, ciclo) ? s + u.montoGasto : s
  }, 0))
  return { auto, manual }
}

/**
 * Los lotes de saldo de una promo: lo reintegrado (topeado) en **cada ciclo** con consumo, con el
 * vencimiento y la marca de "ya lo usé" cargados para ese ciclo. Los ciclos sin reintegro no
 * generan lote. Ordenados por ciclo.
 */
export function lotesPromocion(
  promo: { id: number; porcentaje: number; topeMensual: number; diaReinicio?: number | null },
  gastos: GastoDeCiclo[],
  usos: { fecha: string; montoGasto: number }[],
  reintegros: { mes: number; anio: number; venceEl: string | null; utilizado: boolean }[],
): LoteReintegro[] {
  const dia = diaReinicioDe(promo)
  const ciclos = new Map<string, { mes: number; anio: number }>()
  const agregar = (c: { mes: number; anio: number } | null) => {
    if (c) ciclos.set(`${c.anio}-${pad2(c.mes)}`, c)
  }
  gastos.filter(g => g.promocionId === promo.id).forEach(g => agregar(cicloDeGasto(g, dia)))
  usos.forEach(u => agregar(cicloDeFecha(u.fecha, dia)))

  const lotes: LoteReintegro[] = []
  for (const [, c] of Array.from(ciclos.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    const { auto, manual } = consumoEnCiclo(promo, c, gastos, usos)
    const monto = progresoPromocion(promo, auto, manual).reintegrado
    if (monto <= 0) continue
    const fila = reintegros.find(r => mismoCiclo(r, c))
    lotes.push({
      mes: c.mes,
      anio: c.anio,
      desde: rangoCiclo(c.mes, c.anio, dia).desde,
      monto,
      vence_el: fila?.venceEl ?? null,
      utilizado: !!fila?.utilizado,
    })
  }
  return lotes
}

export type EstadoLote = 'disponible' | 'usado' | 'vencido'

export interface LoteSaldo extends LoteReintegro {
  usado: number
  /** Lo que queda de este lote (si está vencido, es lo que se perdió). */
  restante: number
  estado: EstadoLote
}

export interface SaldoPromocion {
  /** Lo que tenés para usar hoy: lo reintegrado, menos lo usado, menos lo vencido. */
  disponible: number
  /** Todo lo reintegrado (todos los ciclos). */
  reintegrado: number
  usado: number
  /** Lo que venció sin usarse. */
  vencido: number
  /** Usos cargados por encima del saldo que había a esa fecha (no se descuentan de nada). */
  sin_respaldo: number
  /** El vencimiento más cercano de lo que queda, con el monto que vence ese día. */
  proximo_vencimiento: { vence_el: string; monto: number } | null
  lotes: LoteSaldo[]
}

/**
 * El saldo a favor de una promo al día `hoy`.
 *
 * Cada ciclo con reintegro es un lote (`lotesPromocion`). Los usos del saldo se aplican en orden
 * de fecha y cada uno se descuenta de los lotes **que ya existían y no habían vencido a esa
 * fecha**, primero los que vencen antes (FIFO por vencimiento; sin vencimiento al final): así un
 * uso consume la plata que se iba a perder antes. Lo que un uso no pudo descontar queda en
 * `sin_respaldo`. Un lote marcado "ya lo usé" se toma como consumido entero.
 *
 * Al día `hoy`, lo que quede de un lote vencido (`vence_el < hoy`) se perdió y no suma al saldo.
 */
export function saldoPromocion(
  lotes: LoteReintegro[],
  usos: { fecha: string; monto: number }[],
  hoy: string,
): SaldoPromocion {
  const estado = lotes.map(l => ({ ...l, usado: l.utilizado ? l.monto : 0, restante: l.utilizado ? 0 : l.monto }))
  let sinRespaldo = 0

  const ordenUso = [...usos].sort((a, b) => a.fecha.localeCompare(b.fecha))
  for (const u of ordenUso) {
    let falta = u.monto
    const elegibles = estado
      .filter(l => l.restante > 0 && l.desde <= u.fecha && (!l.vence_el || u.fecha <= l.vence_el))
      .sort((a, b) => {
        if (a.vence_el !== b.vence_el) {
          if (!a.vence_el) return 1
          if (!b.vence_el) return -1
          return a.vence_el.localeCompare(b.vence_el)
        }
        return a.desde.localeCompare(b.desde)
      })
    for (const l of elegibles) {
      if (falta <= 0) break
      const toma = Math.min(l.restante, falta)
      l.restante = r2(l.restante - toma)
      l.usado = r2(l.usado + toma)
      falta = r2(falta - toma)
    }
    sinRespaldo = r2(sinRespaldo + Math.max(0, falta))
  }

  const conEstado: LoteSaldo[] = estado.map(l => ({
    ...l,
    estado: l.restante <= 0 ? 'usado' : l.vence_el && l.vence_el < hoy ? 'vencido' : 'disponible',
  }))
  const vivos = conEstado.filter(l => l.estado === 'disponible')
  const conFecha = vivos.filter(l => l.vence_el).sort((a, b) => (a.vence_el as string).localeCompare(b.vence_el as string))
  const proxima = conFecha[0]?.vence_el ?? null

  return {
    disponible: r2(vivos.reduce((s, l) => s + l.restante, 0)),
    reintegrado: r2(conEstado.reduce((s, l) => s + l.monto, 0)),
    usado: r2(conEstado.reduce((s, l) => s + l.usado, 0)),
    vencido: r2(conEstado.filter(l => l.estado === 'vencido').reduce((s, l) => s + l.restante, 0)),
    sin_respaldo: sinRespaldo,
    proximo_vencimiento: proxima
      ? { vence_el: proxima, monto: r2(conFecha.filter(l => l.vence_el === proxima).reduce((s, l) => s + l.restante, 0)) }
      : null,
    lotes: conEstado,
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

// ── Criterios vinculados (conceptos / categorías / etiquetas) ─────────────────────────

export interface PromoCriterios {
  conceptoIds: number[]
  categoriaIds: number[]
  etiquetaIds: number[]
}

/** Los ids de los criterios de una fila de Prisma (con `conceptos`/`categorias`/`etiquetas` incluidos). */
export function criteriosDe(row: {
  conceptos?: { id: number }[]
  categorias?: { id: number }[]
  etiquetas?: { id: number }[]
}): PromoCriterios {
  return {
    conceptoIds: (row.conceptos ?? []).map(c => c.id),
    categoriaIds: (row.categorias ?? []).map(c => c.id),
    etiquetaIds: (row.etiquetas ?? []).map(e => e.id),
  }
}

/** Si la promo tiene algún criterio vinculado. Sin ninguno no se sugiere ni lista candidatos. */
export function tieneCriterios(c: PromoCriterios): boolean {
  return c.conceptoIds.length > 0 || c.categoriaIds.length > 0 || c.etiquetaIds.length > 0
}

/**
 * Si un gasto coincide con los criterios de la promo: su concepto, su categoría o **alguna** de
 * sus etiquetas está entre los vinculados. Los ejes se combinan con **OR** (igual que varios
 * conceptos entre sí): vincular una categoría amplía la promo, no la restringe.
 */
export function criterioCoincide(
  promo: PromoCriterios,
  gasto: { conceptoId: number | null; categoriaId: number | null; etiquetaIds: number[] },
): boolean {
  if (gasto.conceptoId != null && promo.conceptoIds.includes(gasto.conceptoId)) return true
  if (gasto.categoriaId != null && promo.categoriaIds.includes(gasto.categoriaId)) return true
  return gasto.etiquetaIds.some(id => promo.etiquetaIds.includes(id))
}

/**
 * Condiciones (para un `OR` de Prisma sobre `Gasto`) que traen los gastos que coinciden con los
 * criterios: el pre-filtro en la DB de `criterioCoincide`. `[]` si la promo no tiene criterios.
 */
export function whereGastoCriterios(c: PromoCriterios): Record<string, unknown>[] {
  const or: Record<string, unknown>[] = []
  if (c.conceptoIds.length) or.push({ conceptoId: { in: c.conceptoIds } })
  if (c.categoriaIds.length) or.push({ categoriaId: { in: c.categoriaIds } })
  if (c.etiquetaIds.length) or.push({ etiquetas: { some: { id: { in: c.etiquetaIds } } } })
  return or
}

/**
 * Si la promo vale el día de la semana de `fecha` (`YYYY-MM-DD`). Sin fecha válida no hay
 * criterio y no se descarta nada.
 */
export function diaCoincide(promo: { dias: number[] }, fecha: unknown): boolean {
  const dia = diaSemanaDeFecha(fecha)
  return dia == null || promo.dias.includes(dia)
}

// ── Ciclo del tope (día de reinicio) ─────────────────────────────────────────────────
//
// El tope se reinicia el `diaReinicio` de cada mes (default 1 = mes calendario). El ciclo
// `(mes, anio)` va del día de reinicio de ese mes al día anterior al reinicio del siguiente:
// con reinicio el 5, el ciclo de noviembre es 05/11 → 04/12. Lo que no se usó del tope al
// llegar el reinicio se pierde; lo ya reintegrado pasa al saldo (ver `saldoPromocion`).

const pad2 = (n: number) => String(n).padStart(2, '0')
const fechaStr = (anio: number, mes: number, dia: number) => `${anio}-${pad2(mes)}-${pad2(dia)}`

/** Último día del mes (28–31). */
export function ultimoDiaDelMes(mes: number, anio: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate()
}

/** Día en que arranca el ciclo de `(mes, anio)`: el de reinicio, recortado al último del mes. */
function diaInicio(mes: number, anio: number, diaReinicio: number): number {
  return Math.min(Math.max(1, diaReinicio || 1), ultimoDiaDelMes(mes, anio))
}

/** Desde y hasta (YYYY-MM-DD, inclusive) del ciclo que empieza en `(mes, anio)`. */
export function rangoCiclo(mes: number, anio: number, diaReinicio: number): { desde: string; hasta: string } {
  const desde = fechaStr(anio, mes, diaInicio(mes, anio, diaReinicio))
  const sig = shiftMonth(mes, anio, 1)
  // Día anterior al inicio del siguiente ciclo (UTC sobre números, sin correr de día).
  const fin = new Date(Date.UTC(sig.anio, sig.mes - 1, diaInicio(sig.mes, sig.anio, diaReinicio) - 1))
  return { desde, hasta: fechaStr(fin.getUTCFullYear(), fin.getUTCMonth() + 1, fin.getUTCDate()) }
}

/**
 * Ciclo al que pertenece una fecha `YYYY-MM-DD`: el del mes si ya pasó el reinicio, si no el
 * del mes anterior (con reinicio el 5, el 03/12 es del ciclo de noviembre). `null` si la fecha
 * es inválida.
 */
export function cicloDeFecha(fecha: unknown, diaReinicio: number): { mes: number; anio: number } | null {
  const p = mesAnioDeFecha(fecha)
  if (!p) return null
  const dia = Number((fecha as string).slice(8, 10))
  return dia >= diaInicio(p.mes, p.anio, diaReinicio) ? p : shiftMonth(p.mes, p.anio, -1)
}

/**
 * Ciclo al que cuenta un gasto asociado: el de su **fecha de compra con la promo** si la tiene,
 * si no el que empieza en su `mes` (los asociados antes de que existiera la fecha, o a posteriori
 * desde "Gastos que cuentan").
 */
export function cicloDeGasto(
  gasto: { mes: number; anio: number; promocionFecha?: string | null },
  diaReinicio: number,
): { mes: number; anio: number } {
  return cicloDeFecha(gasto.promocionFecha, diaReinicio) ?? { mes: gasto.mes, anio: gasto.anio }
}

const mismoCiclo = (a: { mes: number; anio: number }, b: { mes: number; anio: number }) =>
  a.mes === b.mes && a.anio === b.anio

/**
 * Si la promo está vigente en algún día del ciclo `(mes, anio)` (con reinicio el 1, el mes
 * calendario). Sin límite de un lado = abierta de ese lado. Compara strings `YYYY-MM-DD`
 * (orden lexicográfico = cronológico).
 */
export function vigenteEnCiclo(
  promo: { vigenteDesde?: string | null; vigenteHasta?: string | null; diaReinicio?: number | null },
  mes: number,
  anio: number,
): boolean {
  const { desde, hasta } = rangoCiclo(mes, anio, diaReinicioDe(promo))
  if (promo.vigenteDesde && promo.vigenteDesde > hasta) return false
  if (promo.vigenteHasta && promo.vigenteHasta < desde) return false
  return true
}

/**
 * Fecha de compra con la promo que se guarda en el gasto (`Gasto.promocionFecha`):
 * - `undefined` = no tocar (PUT parcial sin las claves de promo).
 * - `null` = sin fecha: sin promo, o fecha vacía/inválida (cuenta en el ciclo de su mes).
 *
 * Sin promo nunca queda una fecha suelta. `parcial` = PUT (las claves ausentes no se tocan).
 */
export function promocionFechaDeBody(body: any, parcial: boolean): string | null | undefined {
  const valida = (v: unknown) => (mesAnioDeFecha(v) ? (v as string) : null)
  if (body?.promocion_id === undefined) {
    if (!parcial) return null
    return body?.promocion_fecha === undefined ? undefined : valida(body.promocion_fecha)
  }
  if (body.promocion_id === null) return null
  if (body.promocion_fecha === undefined) return parcial ? undefined : null
  return valida(body.promocion_fecha)
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
 * cuenta (el form lo sugiere por concepto/categoría/etiqueta y medio de pago). Los gastos del período ya vienen
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
  /**
   * Saldo a favor para usar hoy, de **todas** las promos (también inactivas o fuera de vigencia:
   * lo ya reintegrado no se pierde porque la promo terminó).
   */
  saldo: number
}

export function totalesPromociones(
  items: { activa: boolean; vigente?: boolean; tope_mensual: number; progreso: ProgresoPromocion; saldo?: { disponible: number } | null }[],
): TotalesPromociones {
  const activas = items.filter(i => i.activa && i.vigente !== false)
  return {
    tope_total: r2(activas.reduce((s, i) => s + i.tope_mensual, 0)),
    reintegrado: r2(activas.reduce((s, i) => s + i.progreso.reintegrado, 0)),
    disponible: r2(activas.reduce((s, i) => s + i.progreso.disponible, 0)),
    completas: activas.filter(i => i.progreso.estado === 'tope_alcanzado').length,
    saldo: r2(items.reduce((s, i) => s + (i.saldo?.disponible ?? 0), 0)),
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

// ── Aviso en /gastos ─────────────────────────────────────────────────────────────────

/**
 * Qué mostrar en el popup de promociones de la pantalla de gastos, el día `hoy` (`YYYY-MM-DD`
 * local): las promos que valen **hoy** y todavía tienen tope por aprovechar (una con el tope
 * agotado no tiene nada que ganar, así que no merece interrumpir), ordenadas por disponible, y
 * las promos con **saldo a favor para usar** (lo reintegrado que todavía no se usó ni venció),
 * las que vencen antes primero y las sin vencimiento al final. `promos` tiene que ser el
 * progreso del **ciclo en curso** de cada promo, no el del período que se esté mirando.
 * `mostrar` es falso cuando no hay ninguna de las dos cosas: el popup no abre.
 */
export function avisoPromociones<
  P extends {
    activa: boolean
    vigente?: boolean
    dias: number[]
    progreso: ProgresoPromocion
    saldo?: Pick<SaldoPromocion, 'disponible' | 'proximo_vencimiento'> | null
  },
>(promos: P[], hoy: string) {
  const dia = diaSemanaDeFecha(hoy)
  const deHoy = dia == null
    ? []
    : ordenarPorDisponible(promosDelDia(promos, dia).filter(p => p.progreso.disponible > 0))
  const saldos = ordenarPorVencimiento(promos.filter(p => (p.saldo?.disponible ?? 0) > 0))
  return {
    deHoy,
    saldos,
    saldoTotal: r2(saldos.reduce((s, p) => s + (p.saldo?.disponible ?? 0), 0)),
    mostrar: deHoy.length > 0 || saldos.length > 0,
  }
}

/** Promos con saldo, la que tiene el vencimiento más cercano primero; sin vencimiento al final. */
export function ordenarPorVencimiento<
  T extends { saldo?: Pick<SaldoPromocion, 'proximo_vencimiento'> | null },
>(promos: T[]): T[] {
  return [...promos].sort((a, b) => {
    const va = a.saldo?.proximo_vencimiento?.vence_el
    const vb = b.saldo?.proximo_vencimiento?.vence_el
    if (va === vb) return 0
    if (!va) return 1
    if (!vb) return -1
    return va.localeCompare(vb)
  })
}
