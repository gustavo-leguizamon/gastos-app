'use client'

import Box from '@mui/material/Box'
import BancoLogo from './BancoLogo'
import BrandLogo from './BrandLogo'
import { hasBancoIcono } from '@/lib/bancos'

export interface TarjetaIconosData {
  nombre: string
  banco?: string | null
  banco_logo?: string | null
  banco_icono?: string | null
  marca?: string | null
}

/** Texto de una tarjeta en los selectores: "Nombre (Banco)". */
export function tarjetaLabel(t: Pick<TarjetaIconosData, 'nombre' | 'banco'>): string {
  return `${t.nombre}${t.banco ? ` (${t.banco})` : ''}`
}

/** Iconos de una tarjeta para selectores: primero el del banco (si hay) y luego el de la marca. */
export function TarjetaIconos({ t }: { t: TarjetaIconosData }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
      {hasBancoIcono(t.banco_icono, t.banco_logo, t.banco) && (
        <BancoLogo banco={t.banco_logo} icono={t.banco_icono} bancoTexto={t.banco} size={22} />
      )}
      <BrandLogo marca={t.marca} width={30} height={22} />
    </Box>
  )
}

/** Opción de select/multiselect: iconos de banco + marca y luego el texto. */
export function TarjetaOpcion({ t }: { t: TarjetaIconosData }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      <TarjetaIconos t={t} />
      <span>{tarjetaLabel(t)}</span>
    </Box>
  )
}
