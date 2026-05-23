import { FaCcVisa, FaCcMastercard, FaCcAmex, FaCcDinersClub, FaCcDiscover, FaCcJcb } from 'react-icons/fa'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import Box from '@mui/material/Box'
import type { TarjetaMarca } from '@/lib/types'

export const MARCAS: { value: TarjetaMarca; label: string }[] = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'amex', label: 'American Express' },
  { value: 'diners', label: 'Diners Club' },
  { value: 'discover', label: 'Discover' },
  { value: 'jcb', label: 'JCB' },
  { value: 'otra', label: 'Otra' },
]

const MARCA_COLORS: Record<TarjetaMarca, string> = {
  visa: '#1a1f71',
  mastercard: '#eb001b',
  amex: '#2e77bb',
  diners: '#0079be',
  discover: '#ff6000',
  jcb: '#0e4c96',
  otra: '#9e9e9e',
}

export function marcaColor(marca: TarjetaMarca | null | undefined): string | undefined {
  return marca ? MARCA_COLORS[marca] : undefined
}

export default function TarjetaLogo({ marca, size = 22, color: colorOverride }: { marca: TarjetaMarca | null | undefined; size?: number; color?: string }) {
  const color = colorOverride ?? (marca ? MARCA_COLORS[marca] : undefined)
  const style = { fontSize: size, color }
  switch (marca) {
    case 'visa':       return <Box component={FaCcVisa}       sx={style} />
    case 'mastercard': return <Box component={FaCcMastercard} sx={style} />
    case 'amex':       return <Box component={FaCcAmex}       sx={style} />
    case 'diners':     return <Box component={FaCcDinersClub} sx={style} />
    case 'discover':   return <Box component={FaCcDiscover}   sx={style} />
    case 'jcb':        return <Box component={FaCcJcb}        sx={style} />
    default:           return <CreditCardIcon sx={{ fontSize: size, color: colorOverride ?? 'text.disabled' }} />
  }
}

/**
 * Badge: ícono de la marca renderizado en blanco sobre un fondo sólido del color
 * oficial de la misma marca. Provee el contraste necesario para distinguir el logo
 * claramente. Se usa para identificar tarjetas en `/configuracion` y en los listados
 * de gastos para mantener consistencia visual.
 */
export function TarjetaLogoBadge({ marca, size = 28 }: { marca: TarjetaMarca | null | undefined; size?: number }) {
  const color = marca ? MARCA_COLORS[marca] : '#9e9e9e'
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size + 16,
        height: size + 8,
        borderRadius: 1,
        bgcolor: color,
        flexShrink: 0,
      }}
    >
      <TarjetaLogo marca={marca} size={size} color="#fff" />
    </Box>
  )
}
