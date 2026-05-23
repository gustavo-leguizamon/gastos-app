'use client'

import CreditCardIcon from '@mui/icons-material/CreditCard'

interface Props {
  marca: string | null | undefined
  width?: number
  height?: number
}

// Logos estilizados por marca de tarjeta. SVGs inline con dimensiones más
// compactas (relación ~1.4:1) para verse menos rectangulares.
// viewBox base: 44 x 32.
export default function BrandLogo({ marca, width = 44, height = 32 }: Props) {
  const m = (marca ?? '').trim().toLowerCase()

  if (m.includes('visa')) {
    return (
      <svg width={width} height={height} viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg" aria-label="Visa">
        <rect width="44" height="32" rx="3" fill="#1a1f71" />
        <text x="22" y="22" fontFamily="Arial Black, Arial, sans-serif" fontSize="12" fontWeight="900" fontStyle="italic" fill="#fff" textAnchor="middle">VISA</text>
      </svg>
    )
  }

  if (m.includes('master')) {
    return (
      <svg width={width} height={height} viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg" aria-label="Mastercard">
        <rect width="44" height="32" rx="3" fill="#fff" stroke="#ddd" strokeWidth="0.5" />
        <circle cx="17" cy="16" r="9" fill="#eb001b" />
        <circle cx="27" cy="16" r="9" fill="#f79e1b" />
        <path d="M22 7.5a9 9 0 0 1 0 17 9 9 0 0 1 0-17Z" fill="#ff5f00" />
      </svg>
    )
  }

  if (m.includes('amex') || m.includes('american')) {
    return (
      <svg width={width} height={height} viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg" aria-label="American Express">
        <rect width="44" height="32" rx="3" fill="#2e77bb" />
        <text x="22" y="14" fontFamily="Arial, sans-serif" fontSize="6" fontWeight="700" fill="#fff" textAnchor="middle" letterSpacing="0.5">AMERICAN</text>
        <text x="22" y="23" fontFamily="Arial, sans-serif" fontSize="6" fontWeight="700" fill="#fff" textAnchor="middle" letterSpacing="0.5">EXPRESS</text>
      </svg>
    )
  }

  if (m.includes('cabal')) {
    return (
      <svg width={width} height={height} viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg" aria-label="Cabal">
        <rect width="44" height="32" rx="3" fill="#0a5e2a" />
        <text x="22" y="21" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="800" fill="#fff" textAnchor="middle" letterSpacing="0.5">CABAL</text>
      </svg>
    )
  }

  if (m.includes('naranja')) {
    return (
      <svg width={width} height={height} viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg" aria-label="Naranja X">
        <rect width="44" height="32" rx="3" fill="#ff6f00" />
        <text x="22" y="21" fontFamily="Arial, sans-serif" fontSize="9" fontWeight="800" fill="#fff" textAnchor="middle">NARANJA</text>
      </svg>
    )
  }

  if (m.includes('diners')) {
    return (
      <svg width={width} height={height} viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg" aria-label="Diners Club">
        <rect width="44" height="32" rx="3" fill="#0079be" />
        <text x="22" y="21" fontFamily="Arial, sans-serif" fontSize="9" fontWeight="800" fill="#fff" textAnchor="middle">DINERS</text>
      </svg>
    )
  }

  if (m.includes('discover')) {
    return (
      <svg width={width} height={height} viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg" aria-label="Discover">
        <rect width="44" height="32" rx="3" fill="#ff6000" />
        <text x="22" y="21" fontFamily="Arial, sans-serif" fontSize="8" fontWeight="800" fill="#fff" textAnchor="middle">DISCOVER</text>
      </svg>
    )
  }

  if (m.includes('jcb')) {
    return (
      <svg width={width} height={height} viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg" aria-label="JCB">
        <rect width="44" height="32" rx="3" fill="#0066b2" />
        <text x="22" y="22" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="900" fill="#fff" textAnchor="middle">JCB</text>
      </svg>
    )
  }

  // Fallback: ícono genérico
  return <CreditCardIcon sx={{ fontSize: height, color: '#6366f1' }} />
}
