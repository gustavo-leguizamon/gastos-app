'use client'

import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import BancoLogo from './BancoLogo'
import MarcaLogo from './MarcaLogo'
import { hasBancoIcono } from '@/lib/bancos'
import { marcaAncho, marcaLabel, tarjetaTitulo } from '@/lib/marcas'

export interface TarjetaConMarcaData {
  nombre: string
  banco?: string | null
  banco_logo?: string | null
  banco_icono?: string | null
  marca?: string | null
}

/**
 * Ícono compacto de una tarjeta: el logo del banco (si hay o se puede inferir) con la
 * marca chiquita en la esquina superior derecha — distingue dos tarjetas del mismo banco
 * (Visa y Mastercard de Galicia) sin ocupar el ancho de dos logos. Sin banco, la marca a
 * tamaño completo. La marca siempre es `MarcaLogo`.
 */
export default function TarjetaConMarca({ t, size = 20, tooltip = true }: {
  t: TarjetaConMarcaData
  /** Alto del logo del banco (o de la marca, si no hay banco). */
  size?: number
  /** `false` donde el contenedor ya tiene su propio tooltip o es una opción de un select. */
  tooltip?: boolean
}) {
  const conBanco = hasBancoIcono(t.banco_icono, t.banco_logo, t.banco)
  const label = marcaLabel(t.marca)
  const conMarca = conBanco && !!label
  // La marca de la esquina: ~80% del ancho del logo del banco.
  const marcaH = Math.round(Math.max(14, Math.round(size * 0.8)) * 32 / 44)
  const marcaW = marcaAncho(marcaH)
  const icono = (
      <Box
        component="span"
        sx={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          flexShrink: 0,
          // Lugar para la marca que asoma por la esquina, así no pisa al ícono de al lado.
          ...(conMarca && { mr: `${Math.round(marcaH * 0.35)}px`, mt: `${Math.round(marcaH * 0.3)}px` }),
        }}
      >
        {conBanco
          ? <BancoLogo banco={t.banco_logo} icono={t.banco_icono} bancoTexto={t.banco} size={size} />
          : <MarcaLogo marca={t.marca} size={size} />}
        {conMarca && (
          <Box
            component="span"
            aria-hidden
            sx={{
              position: 'absolute',
              top: -Math.round(marcaH * 0.4),
              right: -Math.round(marcaW * 0.35),
              display: 'inline-flex',
              lineHeight: 0,
              borderRadius: '2px',
              // Anillo del color del fondo para despegarlo del logo del banco.
              boxShadow: theme => `0 0 0 1px ${theme.palette.background.paper}`,
              pointerEvents: 'none',
            }}
          >
            <MarcaLogo marca={t.marca} size={marcaH} />
          </Box>
        )}
      </Box>
  )
  if (!tooltip) return icono
  return <Tooltip title={tarjetaTitulo(t)}>{icono}</Tooltip>
}
