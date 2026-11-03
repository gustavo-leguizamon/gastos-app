// Lista de compras: mapear lo que lee el OCR ("MEX Anicar Blanco Ledesma Refinado Superior kg E")
// al artículo propio que más se le parece ("Azúcar"). Lógica pura, sin Prisma/Next.
import { normalizarBusqueda } from './lista-compras-compute'

/** Palabras que no distinguen un artículo de otro. */
const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'sin', 'para', 'por', 'una', 'uno', 'un', 'en', 'y', 'x'])

function tokens(s: string): string[] {
  return normalizarBusqueda(s)
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 2 && !VACIAS.has(t) && !/^\d+$/.test(t))
}

/** Distancia de edición (inserciones, borrados y sustituciones). */
function distancia(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/**
 * Cuánto se parece una palabra del artículo a una de la línea leída (0..1): 1 si es igual o una es
 * el comienzo de la otra ("leche" ~ "leches"), y proporcional si difiere en pocas letras —el OCR
 * confunde letras: "anicar" ~ "azucar"—. Las palabras cortas (< 5) sólo coinciden exactas o por prefijo.
 */
function similitud(art: string, leida: string): number {
  if (art === leida) return 1
  const corta = art.length <= leida.length ? art : leida
  const larga = corta === art ? leida : art
  if (corta.length >= 3 && larga.startsWith(corta)) return 0.9
  if (art.length < 5 || leida.length < 5) return 0
  const d = distancia(art, leida)
  const tolerancia = Math.floor(Math.max(art.length, leida.length) / 3)
  return d <= tolerancia ? 1 - d / Math.max(art.length, leida.length) : 0
}

export interface Coincidencia {
  id: number
  /** 0..1: qué parte de las palabras del artículo aparece en lo leído. */
  puntaje: number
}

/** Puntaje mínimo para dar por buena una coincidencia (mitad de las palabras del artículo, con matices). */
export const PUNTAJE_MINIMO = 0.6

/**
 * El artículo de `candidatos` que mejor describe `texto`, o `null` si ninguno alcanza `PUNTAJE_MINIMO`.
 * Mide qué porción de las palabras **del artículo** aparece en el texto (no al revés: la línea leída trae
 * marca, tamaño y ruido de más, el artículo propio es corto). Desempata por más palabras
 * coincidentes (un "Azúcar blanca" gana a "Azúcar" ante "Azúcar blanca Ledesma") y, luego, por el
 * nombre más corto. Un artículo sin palabras útiles nunca coincide.
 */
export function mejorCoincidencia(texto: string, candidatos: Array<{ id: number; nombre: string }>): Coincidencia | null {
  const leidas = tokens(texto)
  if (leidas.length === 0) return null
  let mejor: { id: number; puntaje: number; palabras: number; largo: number } | null = null
  for (const c of candidatos) {
    const propias = tokens(c.nombre)
    if (propias.length === 0) continue
    let suma = 0
    let palabras = 0
    for (const p of propias) {
      const s = Math.max(...leidas.map((l) => similitud(p, l)))
      suma += s
      if (s > 0) palabras++
    }
    const puntaje = suma / propias.length
    if (puntaje < PUNTAJE_MINIMO) continue
    const mas =
      !mejor ||
      puntaje > mejor.puntaje + 1e-9 ||
      (Math.abs(puntaje - mejor.puntaje) < 1e-9 && (palabras > mejor.palabras || (palabras === mejor.palabras && c.nombre.length < mejor.largo)))
    if (mas) mejor = { id: c.id, puntaje, palabras, largo: c.nombre.length }
  }
  return mejor ? { id: mejor.id, puntaje: mejor.puntaje } : null
}
