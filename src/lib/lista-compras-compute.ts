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
  /** Sólo si el artículo se crea: verlo en kg/l. Uno existente conserva su preferencia. */
  mostrarEnMultiplo: boolean
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
  if (body.mostrar_en_multiplo !== undefined && typeof body.mostrar_en_multiplo !== 'boolean') return null
  return { nombre, unidadId, rubroId, cantidad, precioUnitario, mes, anio, mostrarEnMultiplo: body.mostrar_en_multiplo === true }
}

/** `YYYY-MM-DD` real (rechaza 2026-02-30). Se parsea a mano: `new Date(str)` correría el día en UTC. */
export function fechaValida(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export interface CompraBody {
  cantidad: number
  /** null = no se anotó el precio de esta compra. */
  precioUnitario: number | null
  fecha: string
}

/**
 * Alta/edición de una compra: `{ cantidad > 0, precio_unitario?, fecha }`. La fecha la manda el
 * cliente (fecha local, no la UTC del server) y es obligatoria.
 */
export function parseCompraBody(body: any): CompraBody | null {
  if (!body || typeof body !== 'object') return null
  const cantidad = Number(body.cantidad)
  if (!Number.isFinite(cantidad) || cantidad <= 0) return null
  const precioUnitario = parsePrecio(body.precio_unitario)
  if (precioUnitario === undefined) return null
  if (!fechaValida(body.fecha)) return null
  return { cantidad, precioUnitario, fecha: body.fecha }
}

export interface CompraResponse {
  id: number
  cantidad: number
  precio_unitario: number | null
  fecha: string
}

export function toCompraResponse(row: any): CompraResponse {
  return { id: row.id, cantidad: row.cantidad, precio_unitario: row.precioUnitario ?? null, fecha: row.fecha }
}

/**
 * Lo que las compras le dicen a su línea: `cantidadComprada` = suma de todas, y
 * `precioPromedio` = promedio **ponderado por cantidad** de las que tienen precio (null si
 * ninguna). Es ponderado, no simple: 2 kg a $1.000 y 3 kg a $1.100 salen $1.060, y
 * `cantidad × promedio` coincide con lo realmente pagado, así que `gastado` no se desvía.
 * Las compras sin precio **o con precio 0** suman cantidad pero no entran al promedio: un 0
 * (regalo, promo, precio no anotado) hundiría el precio de referencia del mes siguiente.
 */
export function resumenCompras(
  compras: { cantidad: number; precioUnitario: number | null }[],
): { cantidadComprada: number; precioPromedio: number | null } {
  let total = 0
  let conPrecio = 0
  let importe = 0
  for (const c of compras) {
    total += c.cantidad
    if (c.precioUnitario != null && c.precioUnitario > 0) {
      conPrecio += c.cantidad
      importe += c.cantidad * c.precioUnitario
    }
  }
  return {
    cantidadComprada: Math.round(total * 1e6) / 1e6,
    precioPromedio: conPrecio > 0 ? importe / conPrecio : null,
  }
}

export interface ItemPatch {
  cantidad?: number
  precioUnitario?: number | null
  /** Cuánto se lleva comprado (acumulado, no el de una compra puntual). */
  cantidadComprada?: number
  /** Atajo: `true` = llevo todo, `false` = nada. Lo traduce `resolverPatchComprado`. */
  comprado?: boolean
  unidadId?: number
  /** Preferencia de visualización del artículo en g/ml: true = ver y cargar en kg/l. */
  mostrarEnMultiplo?: boolean
  /** null = quitar el rubro. */
  rubroId?: number | null
  /** Nuevo nombre del artículo (normalizado; vale para todos los meses). */
  nombre?: string
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
  if ('mostrar_en_multiplo' in body) {
    if (typeof body.mostrar_en_multiplo !== 'boolean') return null
    patch.mostrarEnMultiplo = body.mostrar_en_multiplo
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
  if ('nombre' in body) {
    if (typeof body.nombre !== 'string') return null
    const n = normalizeNombre(body.nombre)
    if (!n) return null
    patch.nombre = n
  }
  return Object.keys(patch).length ? patch : null
}

/** Alta de una unidad o un rubro: `{ nombre }` normalizado, o `null` si queda vacío. */
/** Base a la que equivale una unidad que es su milésima parte: g → "kg", ml → "l", mm → "m". */
export type SubunidadDe = 'kg' | 'l' | 'm'

/** La unidad chica de cada base: en la que se registran las cantidades. */
export const SUBUNIDAD: Record<SubunidadDe, string> = { kg: 'g', l: 'ml', m: 'mm' }

/** Cuántas subunidades entran en una base (1000 g = 1 kg, 1000 ml = 1 l, 1000 mm = 1 m). */
export const FACTOR_SUBUNIDAD = 1000

/** `undefined` = inválido; vacío/null = sin equivalencia. */
export function parseSubunidadDe(v: unknown): SubunidadDe | null | undefined {
  if (v === null || v === undefined || v === '') return null
  return v === 'kg' || v === 'l' || v === 'm' ? v : undefined
}

/**
 * Cantidades: se **registran siempre en la unidad del artículo** (g, ml, un…), nunca en kg/l. En
 * pantalla, en los artículos en g/ml, se puede elegir cargar en el múltiplo (kg/l): `multiplo`
 * = true significa que lo tipeado está en kg/l y se multiplica por 1000 al guardar.
 * Redondeo a 6 decimales para que 1,1 kg no quede en 1100.0000000000002 g.
 */
export function aCantidadBase(valor: number, multiplo: boolean): number {
  return Math.round((multiplo ? valor * FACTOR_SUBUNIDAD : valor) * 1e6) / 1e6
}

/** Inversa de `aCantidadBase`: la cantidad guardada (g/ml) expresada en lo que se eligió ver. */
export function desdeCantidadBase(valor: number, multiplo: boolean): number {
  return Math.round((multiplo ? valor / FACTOR_SUBUNIDAD : valor) * 1e6) / 1e6
}

/**
 * Texto del campo de cantidad al cambiar la unidad en que se carga (g ↔ kg). Si el campo muestra
 * todavía la cantidad de referencia (lo guardado o lo precargado), se **convierte** — 2500 g pasa
 * a 2,5 kg, sigue siendo la misma cantidad y no se guarda nada distinto —. Si ya se tipeó otro
 * número, se **conserva**: quien tipea "1" y elige kg quiere decir 1 kg.
 */
export function textoAlCambiarUnidad(texto: string, multiploActual: boolean, multiploNuevo: boolean, referencia: number | null): string {
  if (multiploActual === multiploNuevo || referencia == null) return texto
  const v = Number(texto.trim().replace(',', '.'))
  if (texto.trim() === '' || !Number.isFinite(v)) return texto
  if (aCantidadBase(v, multiploActual) !== referencia) return texto
  return String(desdeCantidadBase(referencia, multiploNuevo))
}

const MULTIPLOS: Record<string, SubunidadDe> = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogramo: 'kg', kilogramos: 'kg',
  l: 'l', lt: 'l', lts: 'l', litro: 'l', litros: 'l',
  m: 'm', mt: 'm', mts: 'm', metro: 'm', metros: 'm',
}

/**
 * Si un nombre de unidad es un **múltiplo** (kg, kilo, l, litro…): esas no se usan como unidad de
 * un artículo — se registra en g/ml y el kg/l se elige al cargar la cantidad.
 */
export function esUnidadMultiplo(nombre: string): SubunidadDe | null {
  const n = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\./g, '').trim().toLowerCase()
  return MULTIPLOS[n] ?? null
}

/** Por qué no se acepta una unidad kg/l/m (alta o renombre). */
export function errorMultiplo(multiplo: SubunidadDe): string {
  const sub = SUBUNIDAD[multiplo]
  return `Los artículos se registran en ${sub}: usá "${sub}" y elegí "${multiplo}" al cargar la cantidad`
}

const SUBUNIDADES_A_KG = ['g', 'gr', 'grs', 'gramo', 'gramos']
const SUBUNIDADES_A_L = ['ml', 'mls', 'cc', 'mililitro', 'mililitros']
const SUBUNIDADES_A_M = ['mm', 'milimetro', 'milimetros']

/**
 * Equivalencia que se le asigna a una unidad recién creada por su nombre (sin acentos ni
 * mayúsculas ni puntos): "g", "gr", "gramos" → kg; "ml", "cc", "mililitros" → l. Cualquier otro
 * nombre → null (se puede fijar a mano en el administrador).
 */
export function inferirSubunidad(nombre: string): SubunidadDe | null {
  const n = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').trim().toLowerCase()
  if (SUBUNIDADES_A_KG.includes(n)) return 'kg'
  if (SUBUNIDADES_A_L.includes(n)) return 'l'
  if (SUBUNIDADES_A_M.includes(n)) return 'm'
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

/** Cómo se tipea el precio de una compra: por unidad (por kg/litro si es g/ml) o como total pagado. */
export type ModoPrecio = 'unitario' | 'total'

/**
 * Lo tipeado → precio por la unidad de la línea (lo que se guarda).
 * - `unitario`: es por kg/litro si la unidad es g/ml (`desdePrecioBase`), si no ya es por unidad.
 * - `total`: lo que costó esa cantidad, así que es `total ÷ cantidad` (500 g por $2.000 → $4 por g).
 *   Sin cantidad válida no se puede calcular y devuelve `null`.
 */
export function precioUnitarioDeEntrada(
  modo: ModoPrecio,
  valor: number,
  cantidad: number | null,
  sub: SubunidadDe | null,
): number | null {
  if (modo === 'unitario') return desdePrecioBase(valor, sub)
  return cantidad != null && cantidad > 0 ? valor / cantidad : null
}

/**
 * Inversa de `precioUnitarioDeEntrada`: cómo mostrar en el campo un precio ya guardado según el
 * modo elegido (para no perder el número al cambiar entre "unitario" y "total pagado"). El total
 * se redondea a centavos. `null` si en modo total no hay cantidad válida.
 */
export function entradaDePrecio(
  modo: ModoPrecio,
  precioUnitario: number,
  cantidad: number | null,
  sub: SubunidadDe | null,
): number | null {
  if (modo === 'unitario') return aPrecioBase(precioUnitario, sub)
  return cantidad != null && cantidad > 0 ? Math.round(precioUnitario * cantidad * 100) / 100 : null
}

/**
 * Qué se precarga al registrar una compra de un artículo: lo que **falta** para completar la línea
 * (o lo pedido, si ya se completó) y el **último precio conocido** (promedio del mes, o la referencia
 * del mes anterior). Sin línea en el mes, la última cantidad y el último precio del artículo. Todo en
 * la unidad del artículo (g/ml…); `null` = no hay de dónde sacarlo.
 */
export function precargaCompra(
  linea: { faltante: number; cantidad: number; precio_unitario: number | null; referencia: { precio_unitario: number } | null } | null,
  articulo: { ultima_cantidad: number | null; ultimo_precio: number | null } | null,
): { cantidad: number | null; precio_unitario: number | null } {
  if (linea) {
    return {
      cantidad: linea.faltante > 0 ? linea.faltante : linea.cantidad,
      precio_unitario: linea.precio_unitario ?? linea.referencia?.precio_unitario ?? articulo?.ultimo_precio ?? null,
    }
  }
  return { cantidad: articulo?.ultima_cantidad ?? null, precio_unitario: articulo?.ultimo_precio ?? null }
}

/**
 * Lo último que se usó de un artículo, para precargar el alta: la cantidad de su línea más reciente y
 * el último precio que tuvo (que puede ser de una línea anterior). `lineas` de la más nueva a la más vieja.
 */
export function ultimosDeArticulo(
  lineas: Array<{ cantidad: number; precioUnitario: number | null }>,
): { cantidad: number | null; precio: number | null } {
  return {
    cantidad: lineas[0]?.cantidad ?? null,
    precio: lineas.find((l) => l.precioUnitario != null)?.precioUnitario ?? null,
  }
}

/** Minúsculas, sin acentos y con espacios colapsados, para comparar: "Café" encuentra "cafe". */
export function normalizarBusqueda(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Si una línea coincide con lo escrito en el buscador: **todas** las palabras tienen que aparecer
 * en el nombre del artículo o en su rubro (en cualquier orden y como parte de una palabra:
 * "yer" encuentra "Yerba mate", "alm yer" encuentra "Yerba" del rubro Almacén). Texto vacío =
 * coincide todo.
 */
export function coincideBusqueda(item: { nombre: string; rubro: string | null }, texto: string): boolean {
  const palabras = normalizarBusqueda(texto).split(' ').filter(Boolean)
  if (palabras.length === 0) return true
  const pajar = normalizarBusqueda(`${item.nombre} ${item.rubro ?? ''}`)
  return palabras.every((p) => pajar.includes(p))
}

/**
 * Rubros plegados, tal como se guardan en el navegador (JSON de un array de nombres). Tolera lo que
 * no sea eso —vacío, JSON roto, otro tipo, elementos que no son texto— devolviendo `[]`: es una
 * comodidad por usuario y nunca debe romper la pantalla.
 */
export function parseColapsados(raw: string | null): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
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

/**
 * Cuánto suman/restan los botones +/− de "lo llevado": 1 en general, 100 si la unidad es g o ml
 * (de a 1 g no se llega nunca; las cantidades en gramos se compran de a cientos).
 */
export function pasoLlevo(sub: SubunidadDe | null): number {
  return sub ? 100 : 1
}

/** Suma (`1`) o resta (`-1`) un paso a lo llevado. Nunca baja de 0 y redondea el ruido de float. */
export function ajustarLlevo(actual: number, direccion: 1 | -1, sub: SubunidadDe | null): number {
  return Math.max(0, Math.round((actual + direccion * pasoLlevo(sub)) * 1000) / 1000)
}

/** Tolerancia para comparar cantidades en float (0.1 + 0.2 ≠ 0.3). */
const EPS = 1e-9

/** La línea está completa cuando lo llevado alcanza (o supera) lo pedido. */
export function esCompleto(cantidad: number, cantidadComprada: number): boolean {
  return cantidadComprada >= cantidad - EPS
}

/** Cómo viene lo llevado respecto de lo pedido (`cantidad`). */
export type EstadoCantidad = 'sin_compras' | 'por_debajo' | 'completo' | 'por_encima'

/**
 * Compara lo llevado con la cantidad **pedida** (el "límite previsto") y dice si falta, está justo
 * o se pasó. `sin_compras` es lo que todavía no se empezó a comprar: no es una alerta, es
 * pendiente. `por_debajo` = algo llevado pero menos de lo pedido; `por_encima` = se llevó más
 * (se compró de más). Cualquier diferencia cuenta, con tolerancia sólo para el error de float.
 */
export function estadoCantidad(cantidad: number, cantidadComprada: number): EstadoCantidad {
  if (cantidadComprada <= EPS) return 'sin_compras'
  if (cantidadComprada > cantidad + EPS) return 'por_encima'
  if (cantidadComprada >= cantidad - EPS) return 'completo'
  return 'por_debajo'
}

/** Filtro por estado de la lista: todas, las que faltan, las ya compradas, las compradas de más. */
export type FiltroEstado = 'todos' | 'faltan' | 'realizadas' | 'de_mas'

/**
 * Si una línea entra en el filtro de estado. `faltan` = todavía no alcanza lo pedido (sin compras
 * o por debajo); `realizadas` = ya se llevó lo pedido, **incluidas** las que se pasaron (están
 * compradas); `de_mas` = sólo las que se llevaron más de lo pedido. `faltan` y `realizadas` son
 * complementarias: entre las dos cubren toda la lista.
 */
export function coincideEstado(item: { cantidad: number; cantidad_comprada: number }, filtro: FiltroEstado): boolean {
  if (filtro === 'todos') return true
  const estado = estadoCantidad(item.cantidad, item.cantidad_comprada)
  if (filtro === 'de_mas') return estado === 'por_encima'
  const completa = estado === 'completo' || estado === 'por_encima'
  return filtro === 'realizadas' ? completa : !completa
}

/** Cuántas líneas entran en cada filtro de estado (para los contadores de los chips). */
export function contarPorEstado(items: { cantidad: number; cantidad_comprada: number }[]): Record<FiltroEstado, number> {
  const filtros: FiltroEstado[] = ['todos', 'faltan', 'realizadas', 'de_mas']
  return Object.fromEntries(filtros.map((f) => [f, items.filter((i) => coincideEstado(i, f)).length])) as Record<FiltroEstado, number>
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
  /** Ver las cantidades en kg/l (sólo con `subunidad_de`); se guardan igual en g/ml. */
  mostrar_en_multiplo: boolean
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
  /** Cuánto se llevó de más respecto de lo pedido (0 si no se pasó). */
  exceso: number
  /** Lo llevado vs. lo pedido: sin compras / por debajo / completo / por encima (alerta). */
  estado_cantidad: EstadoCantidad
  /** Derivado: `cantidad_comprada >= cantidad`. */
  comprado: boolean
  /** Lo gastado + lo que falta al precio de la línea (ver `importesLinea`), o `null` sin precio. Derivado. */
  total: number | null
  /** Lo que ya se gastó en la línea (ver `importesLinea`); `null` si no se puede saber. */
  total_llevado: number | null
  /** Compras registradas, por fecha. Si hay, lo llevado y el precio salen de ellas (no se editan a mano). */
  compras: CompraResponse[]
  referencia: Referencia | null
}

/**
 * Cuánto se gastó en una línea y cuánto va a salir en total.
 *
 * - **Sin compras registradas** (llevo cargado a mano): `llevado × precio` y `cantidad × precio`.
 * - **Con compras**: lo gastado es lo **realmente pagado** — la suma de `cantidad × precio` de
 *   cada compra, así una compra a $0 (regalo, promo) cuesta 0 aunque el promedio no la cuente
 *   (ver `resumenCompras`). Las compras **sin precio** no se sabe cuánto costaron: se valorizan al
 *   precio de la línea, y sin él lo gastado es `null`. El total es lo gastado más lo que falta
 *   comprar al precio de la línea (comprar de más no lo baja: lo pagado, pagado está).
 *
 * `null` = no se puede calcular (≠ 0, que es un importe real).
 */
export function importesLinea(linea: {
  cantidad: number
  cantidadComprada: number
  precioUnitario: number | null
  compras?: { cantidad: number; precioUnitario: number | null }[]
}): { total: number | null; totalLlevado: number | null } {
  const precio = linea.precioUnitario
  const compras = linea.compras ?? []
  if (compras.length === 0) {
    return {
      total: precio == null ? null : linea.cantidad * precio,
      totalLlevado: precio == null ? null : linea.cantidadComprada * precio,
    }
  }
  let pagado = 0
  let sinPrecio = 0
  for (const c of compras) {
    if (c.precioUnitario == null) sinPrecio += c.cantidad
    else pagado += c.cantidad * c.precioUnitario
  }
  const totalLlevado = sinPrecio === 0 ? pagado : precio == null ? null : pagado + sinPrecio * precio
  const faltante = Math.max(0, linea.cantidad - linea.cantidadComprada)
  const total = totalLlevado == null ? null : faltante === 0 ? totalLlevado : precio == null ? null : totalLlevado + faltante * precio
  return { total, totalLlevado }
}

export function toItemResponse(row: any, referencia: Referencia | null): ItemResponse {
  const precio: number | null = row.precioUnitario ?? null
  const importes = importesLinea(row)
  return {
    id: row.id,
    articulo_id: row.articuloId,
    nombre: row.articulo.nombre,
    unidad_id: row.articulo.unidadId,
    unidad: row.articulo.unidad.nombre,
    subunidad_de: row.articulo.unidad.subunidadDe ?? null,
    mostrar_en_multiplo: !!row.articulo.mostrarEnMultiplo,
    rubro_id: row.articulo.rubroId ?? null,
    rubro: row.articulo.rubro?.nombre ?? null,
    mes: row.mes,
    anio: row.anio,
    cantidad: row.cantidad,
    precio_unitario: precio,
    cantidad_comprada: row.cantidadComprada,
    faltante: Math.max(0, row.cantidad - row.cantidadComprada),
    exceso: Math.round(Math.max(0, row.cantidadComprada - row.cantidad) * 1e6) / 1e6,
    estado_cantidad: estadoCantidad(row.cantidad, row.cantidadComprada),
    comprado: esCompleto(row.cantidad, row.cantidadComprada),
    total: importes.total,
    total_llevado: importes.totalLlevado,
    compras: (row.compras ?? []).map(toCompraResponse),
    referencia,
  }
}

export interface TotalesLista {
  items: number
  /** Líneas completas (se llevó todo lo pedido). */
  comprados: number
  /** Líneas con algo comprado pero no todo. */
  parciales: number
  /** Líneas donde se llevó MÁS de lo pedido (se compró de más). */
  excedidos: number
  /** Líneas todavía no completas (incluye las parciales). */
  pendientes: number
  /** Lo que ya se gastó: el `total_llevado` de cada línea (lo pagado en sus compras), o llevado × precio. */
  gastado: number
  /** Lo que se estima gastar en total: el `total` de la línea o, sin precio, cantidad × referencia. */
  estimado: number
  /** Líneas sin precio propio ni referencia: el estimado no las cuenta. */
  sin_precio: number
}

export function totalesLista(
  items: (Pick<ItemResponse, 'cantidad' | 'cantidad_comprada' | 'precio_unitario' | 'referencia'> &
    Partial<Pick<ItemResponse, 'total' | 'total_llevado'>>)[],
): TotalesLista {
  let gastado = 0
  let estimado = 0
  let comprados = 0
  let parciales = 0
  let excedidos = 0
  let sinPrecio = 0
  for (const i of items) {
    if (esCompleto(i.cantidad, i.cantidad_comprada)) comprados++
    else if (i.cantidad_comprada > 0) parciales++
    if (estadoCantidad(i.cantidad, i.cantidad_comprada) === 'por_encima') excedidos++
    // Los importes de la línea (`importesLinea`) mandan: con compras, lo pagado de verdad.
    if (i.total_llevado !== undefined) gastado += i.total_llevado ?? 0
    else if (i.precio_unitario != null) gastado += i.cantidad_comprada * i.precio_unitario
    if (i.total != null) estimado += i.total
    else {
      const base = i.precio_unitario ?? i.referencia?.precio_unitario ?? null
      if (base == null) sinPrecio++
      else estimado += i.cantidad * base
    }
  }
  return { items: items.length, comprados, parciales, excedidos, pendientes: items.length - comprados, gastado, estimado, sin_precio: sinPrecio }
}
