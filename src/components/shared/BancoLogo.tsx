'use client'

import Box from '@mui/material/Box'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import { resolveBanco } from '@/lib/bancos'

// Tamaño de fuente del SVG (viewBox 32) según cuántos caracteres tenga la sigla.
const FONT_SIZE: Record<number, number> = { 1: 19, 2: 15, 3: 11, 4: 9 }

interface Props {
  /** Slug del banco guardado en la tarjeta (`banco_logo`). */
  banco: string | null | undefined
  /** Icono subido por el usuario (`banco_icono`, data URI). Gana sobre `banco`. */
  icono?: string | null
  /** Texto libre de `banco`, usado como fallback para inferir el logo. */
  bancoTexto?: string | null
  size?: number
}

/**
 * Icono del banco emisor. Prioridad:
 *   1. imagen subida en configuración (`icono`),
 *   2. badge de la lista fija (sigla sobre el color institucional),
 *   3. `null` — no hay nada que mostrar y el caller no reserva espacio.
 *
 * El badge es SVG inline (sin assets externos), mismo criterio que `BrandLogo`.
 * La lista de bancos y el match viven en `@/lib/bancos`.
 */
export default function BancoLogo({ banco, icono, bancoTexto, size = 20 }: Props) {
  // La imagen va sobre una placa blanca: los logos suelen ser oscuros y con
  // fondo transparente, así se leen igual en tema claro y oscuro.
  if (icono) {
    return (
      <Box
        component="img"
        src={icono}
        alt="Banco"
        sx={{
          width: size,
          height: size,
          borderRadius: '22%',
          objectFit: 'contain',
          bgcolor: '#fff',
          flexShrink: 0,
          display: 'block',
        }}
      />
    )
  }

  const b = resolveBanco(banco, bancoTexto)
  if (!b) return null

  if (b.value === 'otro') {
    return <AccountBalanceIcon sx={{ fontSize: size, color: b.color }} aria-label="Otro banco" />
  }

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-label={b.label}>
      <rect width="32" height="32" rx="7" fill={b.color} />
      <text
        x="16"
        y="16"
        fontFamily="Arial, sans-serif"
        fontSize={FONT_SIZE[b.sigla.length] ?? 9}
        fontWeight="800"
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {b.sigla}
      </text>
    </svg>
  )
}
