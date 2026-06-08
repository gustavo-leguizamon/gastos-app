'use client'

import { ReactNode } from 'react'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { TypographyProps } from '@mui/material/Typography'

type Categoria = { id: number; nombre: string }

interface CategoriasCellProps {
  categorias: Categoria[] | undefined | null
  /** Texto/elemento a renderizar cuando no hay categorías (default: null) */
  empty?: ReactNode
  /** Prefijo opcional, ej. '📍 ' */
  prefix?: string
  /** Props extra para el Typography (color, sx, etc.) */
  typographyProps?: TypographyProps
}

/**
 * Renderiza la lista de categorías ordenada alfabéticamente en una sola línea.
 * Si no entran en el ancho disponible se truncan con ellipsis y se muestra la
 * lista completa en un tooltip al hacer hover.
 */
export default function CategoriasCell({
  categorias,
  empty = null,
  prefix = '',
  typographyProps,
}: CategoriasCellProps) {
  const sorted = [...(categorias ?? [])].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
  )

  if (sorted.length === 0) return <>{empty}</>

  const text = sorted.map(c => c.nombre).join(', ')

  return (
    <Tooltip title={text}>
      <Typography
        variant="caption"
        color="text.secondary"
        {...typographyProps}
        sx={{
          display: 'block',
          width: '100%',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          ...typographyProps?.sx,
        }}
      >
        {prefix}{text}
      </Typography>
    </Tooltip>
  )
}
