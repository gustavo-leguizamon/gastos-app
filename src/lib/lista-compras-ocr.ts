// Lista de compras: de texto reconocido por OCR (foto de una lista escrita o de un ticket) a
// artículos candidatos. Lógica pura (sin Prisma/Next/tesseract): el OCR corre en el navegador y
// acá sólo se interpreta el texto, que es lo que hay que poder testear.
import { fechaValida, normalizarBusqueda } from './lista-compras-compute'

export interface CandidatoOcr {
  nombre: string
  cantidad: number
  /** Nombre de una unidad existente ("kg", "un"...) o `null` si no se detectó. */
  unidad: string | null
  /** Importe de la línea tal como figura en un ticket (total, no unitario); `null` en una lista escrita. */
  total: number | null
}

/** Sinónimos → unidad canónica. */
const ALIAS_UNIDAD: Record<string, string> = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', k: 'kg',
  g: 'g', gr: 'g', grs: 'g', gramo: 'g', gramos: 'g',
  l: 'l', lt: 'l', lts: 'l', litro: 'l', litros: 'l',
  ml: 'ml', cc: 'ml',
  un: 'un', u: 'un', und: 'un', unid: 'un', unidad: 'un', unidades: 'un',
}

/** Líneas de un ticket que no son artículos. */
const RUIDO = /\b(total|subtotal|sub total|iva|cuit|c\.?u\.?i\.?t|fecha|hora|factura|ticket|efectivo|tarjeta|cambio|vuelto|descuento|ahorro|cliente|sucursal|gracias|cae|comprobante|redondeo|recibido|debito|credito|visa|mastercard|cajero|caja|operacion|importe|imp\.?)\b/i

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** `"1.234,50"` → 1234.5; `"12.50"` → 12.5 (coma o punto decimal, con puntos de miles). */
export function parseImporte(s: string): number | null {
  const t = s.trim()
  let n: number
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(t)) n = Number(t.replace(/\./g, '').replace(',', '.'))
  else if (/^\d+[.,]\d{1,2}$/.test(t)) n = Number(t.replace(',', '.'))
  else return null
  return Number.isFinite(n) ? n : null
}

/** Cantidad tipeada: `"2"`, `"1,5"`, `"1/2"`. */
function parseCantidadTexto(s: string): number | null {
  const frac = s.match(/^(\d+)\/(\d+)$/)
  if (frac) {
    const d = Number(frac[2])
    return d > 0 ? Number(frac[1]) / d : null
  }
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Resuelve lo que se leyó ("Kgs.", "litros") a una unidad que existe en la tabla. Primero por
 * sinónimo y, si no, por nombre exacto (para las unidades propias: "paquete", "caja").
 */
export function resolverUnidad(token: string, unidades: string[]): string | null {
  const t = normalizarBusqueda(token).replace(/\.$/, '')
  const canonica = ALIAS_UNIDAD[t] ?? t
  return unidades.find((u) => normalizarBusqueda(u) === canonica) ?? null
}

/** Primera letra en mayúscula y el resto en minúscula ("LECHE ENTERA" → "Leche entera"). */
function formatearNombre(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ')
  const soloMayus = t === t.toUpperCase()
  const base = soloMayus ? t.toLowerCase() : t
  return base.charAt(0).toUpperCase() + base.slice(1)
}

/**
 * Convierte el texto del OCR en artículos candidatos, una línea por artículo. Entiende:
 * - listas escritas: `2 kg manzanas`, `manzanas 2kg`, `leche x2`, `- pan`, `1) yerba`, `3 leches`;
 * - tickets: `LECHE ENTERA 1L   1.234,50` (el importe final es el total de la línea; un `1L` del
 *   nombre es el tamaño del producto, no la cantidad) y `2 x CAFE 3.000,00`.
 * Descarta los renglones que no son artículos (totales, CUIT, forma de pago...) y suma los repetidos.
 * `unidades` son los nombres de las unidades existentes: sólo se devuelven esas.
 */
export function parseLineasOcr(texto: string, unidades: string[]): CandidatoOcr[] {
  const fichas = Array.from(new Set([...Object.keys(ALIAS_UNIDAD), ...unidades.map(normalizarBusqueda)]))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapar)
    .join('|')
  const U = `(?:${fichas})\\.?`
  // "2 kg manzanas", "2kg manzanas", "2 x leche", "3 leches", "1/2 kg pan"
  const reInicio = new RegExp(`^(\\d+(?:[.,]\\d+)?(?:/\\d+)?)\\s*(?:(${U})(?=\\s|$)\\s*(?:de\\s+)?|[xX]\\s+)?(.+)$`, 'i')
  // "manzanas 2 kg", "leche x2", "leche x 2"
  const reFinal = new RegExp(`^(.+?)\\s+(?:[xX]\\s*)?(\\d+(?:[.,]\\d+)?(?:/\\d+)?)\\s*(${U})?$`, 'i')
  const reFinalConX = new RegExp(`^(.+?)\\s+[xX]\\s*(\\d+(?:[.,]\\d+)?)$`)
  const rePrecioFinal = /\s(?:\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})(?:\s*[A-Za-z]{0,2})?\s*$/

  const acumulado = new Map<string, CandidatoOcr>()

  for (const cruda of texto.split(/\r?\n/)) {
    let linea = cruda.replace(/[|_~«»"]+/g, ' ').replace(/\s+/g, ' ').trim()
    // Viñetas, casillas y numeración ("1) ", "2. ") — no el "2 kg" del comienzo.
    linea = linea.replace(/^[-–—•*·>□☐☑✓✔\s]+/, '').replace(/^\d{1,2}[.)]\s+/, '')
    // Código de barras / PLU al comienzo de un renglón de ticket.
    linea = linea.replace(/^\d{6,}\s+/, '')
    if (!linea || (linea.match(/\p{L}/gu)?.length ?? 0) < 2) continue
    if (RUIDO.test(linea)) continue

    // Importe final de un ticket.
    let total: number | null = null
    const p = linea.match(rePrecioFinal)
    if (p) {
      total = parseImporte(p[1])
      linea = linea.slice(0, p.index).trim()
    }

    let nombre = linea
    let cantidad = 1
    let unidad: string | null = null

    const ini = linea.match(reInicio)
    if (ini && ini[3]) {
      const q = parseCantidadTexto(ini[1])
      // "7up" / "5 estrellas": sin unidad ni "x" el número es una cantidad sólo si el resto es una palabra.
      if (q != null && q > 0) {
        cantidad = q
        unidad = ini[2] ? resolverUnidad(ini[2], unidades) : null
        nombre = ini[3]
      }
    } else if (total == null) {
      // En un ticket el "1L" del final es parte del nombre; en una lista escrita es la cantidad.
      const fin = linea.match(reFinal) ?? linea.match(reFinalConX)
      if (fin) {
        const q = parseCantidadTexto(fin[2])
        if (q != null && q > 0) {
          cantidad = q
          unidad = fin[3] ? resolverUnidad(fin[3], unidades) : null
          nombre = fin[1]
        }
      }
    }

    nombre = formatearNombre(nombre.replace(/^[\s\-–—:.,;]+|[\s\-–—:.,;]+$/g, ''))
    if ((nombre.match(/\p{L}/gu)?.length ?? 0) < 2 || nombre.length > 60) continue

    const clave = normalizarBusqueda(nombre)
    const previo = acumulado.get(clave)
    if (previo) {
      previo.cantidad += cantidad
      if (total != null) previo.total = (previo.total ?? 0) + total
      previo.unidad = previo.unidad ?? unidad
    } else {
      acumulado.set(clave, { nombre, cantidad, unidad, total })
    }
  }
  return Array.from(acumulado.values())
}

/**
 * Fecha del ticket (`dd/mm/aaaa`, `dd-mm-aa`, `dd.mm.aaaa`) como `YYYY-MM-DD`: la primera que sea una fecha
 * real y no futura (`hoy`, también `YYYY-MM-DD`; el OCR inventa fechas lejanas). `null` si no hay ninguna.
 */
export function fechaDeTicket(texto: string, hoy: string): string | null {
  for (const m of texto.matchAll(/(?<!\d)(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})(?!\d)/g)) {
    const anio = m[3].length === 2 ? `20${m[3]}` : m[3]
    const f = `${anio}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    if (fechaValida(f) && f <= hoy) return f
  }
  return null
}

/**
 * Precio por unidad de la línea (el que se guarda en una compra) a partir del importe del ticket:
 * `total ÷ cantidad`, redondeado a centavos. `null` sin importe o con cantidad inválida.
 */
export function precioDeTicket(total: number | null, cantidad: number): number | null {
  if (total == null || !(cantidad > 0)) return null
  return Math.round((total / cantidad) * 100) / 100
}
