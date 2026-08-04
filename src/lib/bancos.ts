import type { TarjetaBanco } from './types'

export interface Banco {
  value: TarjetaBanco
  label: string
  /** Color institucional del banco (fondo del badge). */
  color: string
  /** Sigla que se dibuja en el badge (1 a 4 caracteres). */
  sigla: string
  /** Términos extra para inferir el banco desde el texto libre de `banco`. */
  alias?: string[]
}

// Lista fija de bancos/fintechs. El `value` es el slug que se guarda en
// `Tarjeta.bancoLogo`; también se usa para matchear el texto libre de `banco`.
export const BANCOS: Banco[] = [
  { value: 'galicia',     label: 'Galicia',         color: '#ff6b00', sigla: 'G' },
  { value: 'santander',   label: 'Santander',       color: '#ec0000', sigla: 'S' },
  { value: 'bbva',        label: 'BBVA',            color: '#004481', sigla: 'BBVA', alias: ['frances'] },
  { value: 'nacion',      label: 'Banco Nación',    color: '#0a3d91', sigla: 'BNA', alias: ['bna'] },
  { value: 'provincia',   label: 'Banco Provincia', color: '#009639', sigla: 'BP', alias: ['bapro'] },
  { value: 'ciudad',      label: 'Banco Ciudad',    color: '#c8102e', sigla: 'BC' },
  { value: 'macro',       label: 'Macro',           color: '#00539f', sigla: 'M' },
  { value: 'icbc',        label: 'ICBC',            color: '#c8102e', sigla: 'ICBC' },
  { value: 'hsbc',        label: 'HSBC',            color: '#db0011', sigla: 'HSBC' },
  { value: 'supervielle', label: 'Supervielle',     color: '#e2001a', sigla: 'SV' },
  { value: 'patagonia',   label: 'Patagonia',       color: '#00843d', sigla: 'PAT' },
  { value: 'credicoop',   label: 'Credicoop',       color: '#0093d3', sigla: 'CC' },
  { value: 'comafi',      label: 'Comafi',          color: '#862633', sigla: 'CF' },
  { value: 'hipotecario', label: 'Hipotecario',     color: '#003a70', sigla: 'BH' },
  { value: 'brubank',     label: 'Brubank',         color: '#6f2dbd', sigla: 'BRU' },
  { value: 'uala',        label: 'Ualá',            color: '#f5327b', sigla: 'U' },
  { value: 'naranja',     label: 'Naranja X',       color: '#ff6f00', sigla: 'NX' },
  { value: 'mercadopago', label: 'Mercado Pago',    color: '#009ee3', sigla: 'MP', alias: ['mercado pago'] },
  { value: 'otro',        label: 'Otro',            color: '#9e9e9e', sigla: '?' },
]

const BY_VALUE = new Map(BANCOS.map(b => [b.value, b]))

const COMBINING_MARKS = /[̀-ͯ]/g

/** Minúsculas, sin acentos y sin espacios de sobra, para matchear texto libre. */
function norm(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '')
}

/**
 * Resuelve qué banco mostrar para una tarjeta. Gana el slug explícito elegido en
 * configuración (`banco_logo`); si no hay, se infiere del texto libre de `banco`
 * — así las tarjetas ya cargadas muestran logo sin necesidad de re-editarlas.
 * Devuelve `null` cuando no hay match (el caller no renderiza nada).
 */
export function resolveBanco(
  bancoLogo: string | null | undefined,
  bancoTexto?: string | null,
): Banco | null {
  if (bancoLogo) return BY_VALUE.get(norm(bancoLogo) as TarjetaBanco) ?? null
  if (!bancoTexto) return null
  const t = norm(bancoTexto)
  if (!t) return null
  return BANCOS.find(b =>
    b.value !== 'otro' && [b.value, ...(b.alias ?? [])].some(k => t.includes(k))
  ) ?? null
}

/**
 * `true` si la tarjeta tiene algo para mostrar como icono de banco: imagen
 * subida (gana siempre) o banco resuelto por slug/texto. Los callers lo usan
 * para no renderizar el contenedor del badge cuando no hay nada.
 */
export function hasBancoIcono(
  icono: string | null | undefined,
  bancoLogo: string | null | undefined,
  bancoTexto?: string | null,
): boolean {
  return Boolean(icono) || resolveBanco(bancoLogo, bancoTexto) !== null
}

export function bancoColor(
  bancoLogo: string | null | undefined,
  bancoTexto?: string | null,
): string | undefined {
  return resolveBanco(bancoLogo, bancoTexto)?.color
}

export function bancoLabel(
  bancoLogo: string | null | undefined,
  bancoTexto?: string | null,
): string | undefined {
  return resolveBanco(bancoLogo, bancoTexto)?.label
}
