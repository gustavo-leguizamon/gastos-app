'use client'

import CreditCardIcon from '@mui/icons-material/CreditCard'
import { MARCA_ESTILOS, marcaAncho, resolveMarca } from '@/lib/marcas'

interface Props {
  /** Valor de `Tarjeta.marca` o texto libre ("Visa", "American Express"…). */
  marca: string | null | undefined
  /** Alto en px; el ancho sale de la relación 44:32. */
  size?: number
}

/**
 * **El** logo de una marca de tarjeta: rectángulo con el color oficial y el nombre/emblema
 * encima (SVG inline, sin assets). Es el único lugar donde se dibuja una marca — selectores,
 * grilla de gastos, cierres, configuración y promociones lo usan, así que un cambio de estilo
 * acá aplica a todos. Colores y labels: `src/lib/marcas.ts`.
 */
export default function MarcaLogo({ marca, size = 32 }: Props) {
  const key = resolveMarca(marca)
  if (!key) return <CreditCardIcon sx={{ fontSize: size, color: '#6366f1' }} />

  const { label, fondo } = MARCA_ESTILOS[key]
  const svg = (children: React.ReactNode, stroke?: boolean) => (
    <svg width={marcaAncho(size)} height={size} viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg" aria-label={label} style={{ flexShrink: 0 }}>
      <rect width="44" height="32" rx="3" fill={fondo} {...(stroke ? { stroke: '#ddd', strokeWidth: 0.5 } : {})} />
      {children}
    </svg>
  )
  const texto = (t: string, fontSize: number, y = 21, extra: React.SVGProps<SVGTextElement> = {}) => (
    <text x="22" y={y} fontFamily="Arial, sans-serif" fontSize={fontSize} fontWeight="800" fill="#fff" textAnchor="middle" {...extra}>{t}</text>
  )

  switch (key) {
    case 'visa':
      return svg(texto('VISA', 12, 22, { fontFamily: 'Arial Black, Arial, sans-serif', fontWeight: 900, fontStyle: 'italic' }))
    case 'mastercard':
      return svg(<>
        <circle cx="17" cy="16" r="9" fill="#eb001b" />
        <circle cx="27" cy="16" r="9" fill="#f79e1b" />
        <path d="M22 7.5a9 9 0 0 1 0 17 9 9 0 0 1 0-17Z" fill="#ff5f00" />
      </>, true)
    case 'amex':
      return svg(<>
        {texto('AMERICAN', 6, 14, { fontWeight: 700, letterSpacing: 0.5 })}
        {texto('EXPRESS', 6, 23, { fontWeight: 700, letterSpacing: 0.5 })}
      </>)
    case 'cabal':
      return svg(texto('CABAL', 10, 21, { letterSpacing: 0.5 }))
    case 'naranja':
      return svg(texto('NARANJA', 9))
    case 'diners':
      return svg(texto('DINERS', 9))
    case 'discover':
      return svg(texto('DISCOVER', 8))
    case 'jcb':
      return svg(texto('JCB', 12, 22, { fontWeight: 900 }))
  }
}
