// Lista de compras mensual. Lógica pura (sin Prisma/Next) de lo que las routes y la página
// tienen que decidir igual: validar el body, rotular la referencia de precio y totalizar.
import { normalizeNombre } from './conceptos'

export interface ItemBody {
  nombre: string
  unidadId: number
  rubroId: number | null
  cantidad: number
  precioUnitario: number | null
  mes: number
  anio: number
}

const esMes = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 12
const esAnio = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 2000 && (n as number) <= 2100

/** Vacío/ausente → `null`. Distingue "sin precio" de un precio en 0. `undefined` = inválido. */
function parsePrecio(v: unknown): number | null | undefined {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/** Id de FK: entero positivo. `undefined` = inválido. */
function parseId(v: unknown): number | undefined {
  return Number.isInteger(v) && (v as number) > 0 ? (v as number) : undefined
}

/** Alta de una línea: `{ nombre, unidad_id, rubro_id?, cantidad?, precio_unitario?, mes, anio }`. */
export function parseItemBody(body: any): ItemBody | null {
  if (!body || typeof body !== 'object') return null
  const nombre = typeof body.nombre === 'string' ? normalizeNombre(body.nombre) : ''
  if (!nombre) return null
  const { mes, anio } = body
  if (!esMes(mes) || !esAnio(anio)) return null
  const cantidad = body.cantidad === undefined ? 1 : Number(body.cantidad)
  if (!Number.isFinite(cantidad) || cantidad <= 0) return null
  const precioUnitario = parsePrecio(body.precio_unitario)
  if (precioUnitario === undefined) return null
  const unidadId = parseId(body.unidad_id)
  if (unidadId === undefined) return null
  const rubroId = body.rubro_id == null ? null : parseId(body.rubro_id)
  if (rubroId === undefined) return null
  return { nombre, unidadId, rubroId, cantidad, precioUnitario, mes, anio }
}

export interface ItemPatch {
  cantidad?: number
  precioUnitario?: number | null
  /** Cuánto se lleva comprado (acumulado, no el de una compra puntual). */
  cantidadComprada?: number
  /** Atajo: `true` = llevo todo, `false` = nada. Lo traduce `resolverPatchComprado`. */
  comprado?: boolean
  unidadId?: number
  /** null = quitar el rubro. */
  rubroId?: number | null
}

/**
 * Edición parcial: sólo se tocan las claves que vienen. `precio_unitario: null` **borra** el
 * precio (hay que poder distinguirlo de "no mandaron el campo"). `null` si no hay nada que
 * actualizar o algo es inválido.
 */
export function parseItemPatch(body: any): ItemPatch | null {
  if (!body || typeof body !== 'object') return null
  const patch: ItemPatch = {}
  if ('cantidad' in body) {
    const c = Number(body.cantidad)
    if (!Number.isFinite(c) || c <= 0) return null
    patch.cantidad = c
  }
  if ('precio_unitario' in body) {
    const p = parsePrecio(body.precio_unitario)
    if (p === undefined) return null
    patch.precioUnitario = p
  }
  if ('cantidad_comprada' in body) {
    const c = Number(body.cantidad_comprada)
    if (!Number.isFinite(c) || c < 0) return null
    patch.cantidadComprada = c
  }
  if ('comprado' in body) {
    if (typeof body.comprado !== 'boolean') return null
    patch.comprado = body.comprado
  }
  if ('unidad_id' in body) {
    const u = parseId(body.unidad_id)
    if (u === undefined) return null
    patch.unidadId = u
  }
  if ('rubro_id' in body) {
    const r = body.rubro_id === null ? null : parseId(body.rubro_id)
    if (r === undefined) return null
    patch.rubroId = r
  }
  return Object.keys(patch).length ? patch : null
}

/** Alta de una unidad o un rubro: `{ nombre }` normalizado, o `null` si queda vacío. */
/** Base a la que equivale una unidad que es su milésima parte: g → "kg", ml → "l". */
export type SubunidadDe = 'kg' | 'l'

/** Cuántas subunidades entran en una base (1000 g = 1 kg, 1000 ml = 1 l). */
export const FACTOR_SUBUNIDAD = 1000

/** `undefined` = inválido; vacío/null = sin equivalencia. */
export function parseSubunidadDe(v: unknown): SubunidadDe | null | undefined {
  if (v === null || v === undefined || v === '') return null
  return v === 'kg' || v === 'l' ? v : undefined
}

const SUBUNIDADES_A_KG = ['g', 'gr', 'grs', 'gramo', 'gramos']
const SUBUNIDADES_A_L = ['ml', 'mls', 'cc', 'mililitro', 'mililitros']

/**
 * Equivalencia que se le asigna a una unidad recién creada por su nombre (sin acentos ni
 * mayúsculas ni puntos): "g", "gr", "gramos" → kg; "ml", "cc", "mililitros" → l. Cualquier otro
 * nombre → null (se puede fijar a mano en el administrador).
 */
export function inferirSubunidad(nombre: string): SubunidadDe | null {
  const n = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').trim().toLowerCase()
  if (SUBUNIDADES_A_KG.includes(n)) return 'kg'
  if (SUBUNIDADES_A_L.includes(n)) return 'l'
  return null
}

/**
 * Precio por kg/litro a partir del precio por la unidad de la línea (g/ml). Sin equivalencia
 * devuelve el precio tal cual. Redondea a 6 decimales para no mostrar 3999.9900000000002.
 */
export function aPrecioBase(precioUnitario: number, sub: SubunidadDe | null): number {
  return sub ? Math.round(precioUnitario * FACTOR_SUBUNIDAD * 1e6) / 1e6 : precioUnitario
}

/** Inversa de `aPrecioBase`: lo que se tipea (por kg/l) → lo que se guarda (por g/ml). */
export function desdePrecioBase(precioBase: number, sub: SubunidadDe | null): number {
  return sub ? precioBase / FACTOR_SUBUNIDAD : precioBase
}

/** Cambios aceptados al editar una unidad: nombre y/o equivalencia. `null` si no hay nada o es inválido. */
export function parseUnidadPatch(body: any): { nombre?: string; subunidadDe?: SubunidadDe | null } | null {
  if (!body || typeof body !== 'object') return null
  const patch: { nombre?: string; subunidadDe?: SubunidadDe | null } = {}
  if ('nombre' in body) {
    const n = typeof body.nombre === 'string' ? normalizeNombre(body.nombre) : ''
    if (!n) return null
    patch.nombre = n
  }
  if ('subunidad_de' in body) {
    const s = parseSubunidadDe(body.subunidad_de)
    if (s === undefined) return null
    patch.subunidadDe = s
  }
  return Object.keys(patch).length ? patch : null
}

/** Tolerancia para comparar cantidades en float (0.1 + 0.2 ≠ 0.3). */
const EPS = 1e-9

/** La línea está completa cuando lo llevado alcanza (o supera) lo pedido. */
export function esCompleto(cantidad: number, cantidadComprada: number): boolean {
  return cantidadComprada >= cantidad - EPS
}

/**
 * Traduce el atajo `comprado` a una cantidad: `true` → lo pedido (el `cantidad` nuevo si el mismo
 * patch lo cambia), `false` → 0. Si el patch ya trae `cantidadComprada` explícita, esa gana.
 * El resultado nunca lleva `comprado`: lo único que se persiste es la cantidad.
 */
export function resolverPatchComprado(patch: ItemPatch, cantidadActual: number): Omit<ItemPatch, 'comprado'> {
  const { comprado, ...resto } = patch
  if (comprado === undefined || resto.cantidadComprada !== undefined) return resto
  return { ...resto, cantidadComprada: comprado ? (resto.cantidad ?? cantidadActual) : 0 }
}

export function parseNombreCatalogo(body: any): string | null {
  if (!body || typeof body.nombre !== 'string') return null
  return normalizeNombre(body.nombre) || null
}

export function parseCopiarBody(body: any): { mes: number; anio: number } | null {
  if (!body || !esMes(body.mes) || !esAnio(body.anio)) return null
  return { mes: body.mes, anio: body.anio }
}

/** Comparable cronológico de un período. */
const periodoKey = (p: { mes: number; anio: number }) => p.anio * 12 + p.mes

export interface Referencia {
  precio_unitario: number
  cantidad: number
  mes: number
  anio: number
}

/**
 * Última compra con precio de un artículo **anterior** al período mirado: el precio al que
 * salió la última vez, aunque haya sido hace varios meses (si salteaste un mes, la referencia
 * no se pierde). Ignora las filas sin precio y las del propio mes o posteriores.
 */
export function referenciaDe(
  filas: { cantidad: number; precioUnitario: number | null; mes: number; anio: number }[],
  periodo: { mes: number; anio: number },
): Referencia | null {
  let mejor: (typeof filas)[number] | null = null
  for (const f of filas) {
    if (f.precioUnitario == null) continue
    if (periodoKey(f) >= periodoKey(periodo)) continue
    if (!mejor || periodoKey(f) > periodoKey(mejor)) mejor = f
  }
  return mejor
    ? { precio_unitario: mejor.precioUnitario as number, cantidad: mejor.cantidad, mes: mejor.mes, anio: mejor.anio }
    : null
}

/** Cambio porcentual del precio contra la referencia; `null` si falta alguno o la referencia es 0. */
export function variacionPrecio(precio: number | null, referencia: number | null): number | null {
  if (precio == null || referencia == null || referencia === 0) return null
  return ((precio - referencia) / referencia) * 100
}

export interface ItemResponse {
  id: number
  articulo_id: number
  nombre: string
  unidad_id: number
  unidad: string
  /** "kg"/"l" si la unidad es g/ml: el precio se carga y se compara por kg/litro. */
  subunidad_de: SubunidadDe | null
  rubro_id: number | null
  rubro: string | null
  mes: number
  anio: number
  cantidad: number
  precio_unitario: number | null
  /** Cuánto se lleva comprado hasta ahora. */
  cantidad_comprada: number
  /** Lo que falta para completar (0 si ya se llevó todo o más). */
  faltante: number
  /** Derivado: `cantidad_comprada >= cantidad`. */
  comprado: boolean
  /** `cantidad × precio_unitario`, o `null` sin precio. Derivado, no se persiste. */
  total: number | null
  /** `cantidad_comprada × precio_unitario`: lo que ya se gastó en la línea (`null` sin precio). */
  total_llevado: number | null
  referencia: Referencia | null
}

export function toItemResponse(row: any, referencia: Referencia | null): ItemResponse {
  const precio: number | null = row.precioUnitario ?? null
  return {
    id: row.id,
    articulo_id: row.articuloId,
    nombre: row.articulo.nombre,
    unidad_id: row.articulo.unidadId,
    unidad: row.articulo.unidad.nombre,
    subunidad_de: row.articulo.unidad.subunidadDe ?? null,
    rubro_id: row.articulo.rubroId ?? null,
    rubro: row.articulo.rubro?.nombre ?? null,
    mes: row.mes,
    anio: row.anio,
    cantidad: row.cantidad,
    precio_unitario: precio,
    cantidad_comprada: row.cantidadComprada,
    faltante: Math.max(0, row.cantidad - row.cantidadComprada),
    comprado: esCompleto(row.cantidad, row.cantidadComprada),
    total: precio == null ? null : row.cantidad * precio,
    total_llevado: precio == null ? null : row.cantidadComprada * precio,
    referencia,
  }
}

export interface TotalesLista {
  items: number
  /** Líneas completas (se llevó todo lo pedido). */
  comprados: number
  /** Líneas con algo comprado pero no todo. */
  parciales: number
  /** Líneas todavía no completas (incluye las parciales). */
  pendientes: number
  /** Lo que ya se gastó: cantidad llevada × precio, sólo en líneas con precio cargado. */
  gastado: number
  /** Lo que se estima gastar en total: precio del mes o, sin él, el de referencia. */
  estimado: number
  /** Líneas sin precio propio ni referencia: el estimado no las cuenta. */
  sin_precio: number
}

export function totalesLista(
  items: Pick<ItemResponse, 'cantidad' | 'cantidad_comprada' | 'precio_unitario' | 'referencia'>[],
): TotalesLista {
  let gastado = 0
  let estimado = 0
  let comprados = 0
  let parciales = 0
  let sinPrecio = 0
  for (const i of items) {
    if (esCompleto(i.cantidad, i.cantidad_comprada)) comprados++
    else if (i.cantidad_comprada > 0) parciales++
    if (i.precio_unitario != null) gastado += i.cantidad_comprada * i.precio_unitario
    const base = i.precio_unitario ?? i.referencia?.precio_unitario ?? null
    if (base == null) sinPrecio++
    else estimado += i.cantidad * base
  }
  return { items: items.length, comprados, parciales, pendientes: items.length - comprados, gastado, estimado, sin_precio: sinPrecio }
}
