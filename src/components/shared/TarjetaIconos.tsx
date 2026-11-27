'use client'

import Box from '@mui/material/Box'
import TarjetaConMarca from './TarjetaConMarca'
import { tarjetaTitulo } from '@/lib/marcas'

export interface TarjetaIconosData {
  nombre: string
  banco?: string | null
  banco_logo?: string | null
  banco_icono?: string | null
  marca?: string | null
}

/** Texto de una tarjeta en los selectores: "Banco (Marca)", igual que los tooltips (`tarjetaTitulo`). */
export function tarjetaLabel(t: TarjetaIconosData): string {
  return tarjetaTitulo(t)
}

/** Las tarjetas ordenadas por su texto, así el select queda agrupado por banco. */
export function ordenarTarjetas<T extends TarjetaIconosData>(tarjetas: T[]): T[] {
  return [...tarjetas].sort((a, b) => tarjetaLabel(a).localeCompare(tarjetaLabel(b), 'es', { sensitivity: 'base' }))
}

/** Ícono de una tarjeta para selectores: el del banco con la marca en la esquina (`TarjetaConMarca`). */
export function TarjetaIconos({ t }: { t: TarjetaIconosData }) {
  return <TarjetaConMarca t={t} size={22} tooltip={false} />
}

/** Opción de select/multiselect: ícono de la tarjeta (banco + marca en la esquina) y luego el texto. */
export function TarjetaOpcion({ t }: { t: TarjetaIconosData }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      <TarjetaIconos t={t} />
      <span>{tarjetaLabel(t)}</span>
    </Box>
  )
}
