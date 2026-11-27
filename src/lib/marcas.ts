import type { TarjetaMarca } from './types'
import { bancoLabel } from './bancos'

/**
 * Fuente única de las marcas de tarjeta (Visa, Mastercard…): qué marcas hay, cómo se
 * llaman, cómo se resuelven desde texto libre y con qué colores se dibujan.
 *
 * El dibujo vive en `MarcaLogo` (`src/components/shared/MarcaLogo.tsx`), que es el
 * **único** componente que renderiza una marca: cambiar un color o un label acá lo
 * cambia en toda la app. El guard `marca-logo-guard.test.ts` impide volver a dibujar
 * marcas por fuera de él.
 */

/** Marcas que se pueden elegir al cargar una tarjeta (`Tarjeta.marca`). */
export const MARCAS: { value: TarjetaMarca; label: string }[] = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'amex', label: 'American Express' },
  { value: 'diners', label: 'Diners Club' },
  { value: 'discover', label: 'Discover' },
  { value: 'jcb', label: 'JCB' },
  { value: 'otra', label: 'Otra' },
]

/** Marcas que `MarcaLogo` sabe dibujar (incluye las que sólo llegan como texto libre). */
export type MarcaDibujable = Exclude<TarjetaMarca, 'otra'> | 'cabal' | 'naranja'

export interface MarcaEstilo {
  label: string
  /** Fondo del logo. */
  fondo: string
  /** Color de acento de la marca (tinte de cards, bordes). No siempre es el fondo: Mastercard va sobre blanco. */
  acento: string
}

export const MARCA_ESTILOS: Record<MarcaDibujable, MarcaEstilo> = {
  visa: { label: 'Visa', fondo: '#1a1f71', acento: '#1a1f71' },
  mastercard: { label: 'Mastercard', fondo: '#ffffff', acento: '#eb001b' },
  amex: { label: 'American Express', fondo: '#2e77bb', acento: '#2e77bb' },
  diners: { label: 'Diners Club', fondo: '#0079be', acento: '#0079be' },
  discover: { label: 'Discover', fondo: '#ff6000', acento: '#ff6000' },
  jcb: { label: 'JCB', fondo: '#0066b2', acento: '#0066b2' },
  cabal: { label: 'Cabal', fondo: '#0a5e2a', acento: '#0a5e2a' },
  naranja: { label: 'Naranja X', fondo: '#ff6f00', acento: '#ff6f00' },
}

/** Relación ancho:alto del logo (viewBox 44×32). */
export const MARCA_RATIO = 44 / 32

/**
 * Resuelve una marca desde el valor guardado o texto libre ("VISA", "American Express",
 * "Naranja X"). `null` si no hay o no se reconoce (incluye `otra`): se dibuja el genérico.
 */
export function resolveMarca(marca: string | null | undefined): MarcaDibujable | null {
  const m = (marca ?? '').trim().toLowerCase()
  if (!m) return null
  if (m.includes('visa')) return 'visa'
  if (m.includes('master')) return 'mastercard'
  if (m.includes('amex') || m.includes('american')) return 'amex'
  if (m.includes('cabal')) return 'cabal'
  if (m.includes('naranja')) return 'naranja'
  if (m.includes('diners')) return 'diners'
  if (m.includes('discover')) return 'discover'
  if (m.includes('jcb')) return 'jcb'
  return null
}

/** Color de acento de la marca, o `undefined` si no se reconoce. */
export function marcaColor(marca: string | null | undefined): string | undefined {
  const r = resolveMarca(marca)
  return r ? MARCA_ESTILOS[r].acento : undefined
}

/** Nombre legible de la marca, o `undefined` si no se reconoce. */
export function marcaLabel(marca: string | null | undefined): string | undefined {
  const r = resolveMarca(marca)
  return r ? MARCA_ESTILOS[r].label : undefined
}

/**
 * Cómo se nombra una tarjeta en los tooltips: **"Banco (Marca)"** — lo mismo que se ve en
 * el ícono (logo del banco + marca en la esquina). El banco sale del texto libre o, si no
 * hay, del slug de la lista. Sin marca reconocida, el paréntesis lleva el nombre de la
 * tarjeta (para no confundir dos tarjetas del mismo banco); sin banco, "Nombre (Marca)".
 */
export function tarjetaTitulo(t: {
  nombre?: string | null
  banco?: string | null
  banco_logo?: string | null
  marca?: string | null
}): string {
  const nombre = (t.nombre ?? '').trim()
  // `otro` no es un nombre de banco: no se usa como título.
  const banco = (t.banco ?? '').trim() || (t.banco_logo !== 'otro' ? bancoLabel(t.banco_logo) : undefined) || ''
  const marca = marcaLabel(t.marca)
  const principal = banco || nombre
  const detalle = marca ?? (banco && nombre && nombre.toLowerCase() !== banco.toLowerCase() ? nombre : '')
  if (!principal) return detalle
  return detalle && detalle.toLowerCase() !== principal.toLowerCase() ? `${principal} (${detalle})` : principal
}

/** Ancho del logo para un alto dado, respetando la relación del viewBox. */
export function marcaAncho(alto: number): number {
  return Math.round(alto * MARCA_RATIO)
}
