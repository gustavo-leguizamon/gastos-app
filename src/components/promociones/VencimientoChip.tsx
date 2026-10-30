'use client'

import Chip from '@mui/material/Chip'
import EventBusyIcon from '@mui/icons-material/EventBusy'
import EventIcon from '@mui/icons-material/Event'
import { estadoVencimiento, type NivelVencimiento } from '@/lib/promociones-compute'

const fmtFecha = (f: string) => f.split('-').reverse().join('/')

const COLOR: Record<NivelVencimiento, 'error' | 'warning' | 'default'> = {
  vencido: 'error',
  urgente: 'error',
  proximo: 'warning',
  ok: 'default',
}

/** "Vence hoy" / "Vence en 5 días" / "Venció hace 2 días" según los días que faltan. */
export function textoDias(dias: number) {
  if (dias === 0) return 'vence hoy'
  if (dias === 1) return 'vence mañana'
  if (dias > 1) return `vence en ${dias} días`
  return dias === -1 ? 'venció ayer' : `venció hace ${-dias} días`
}

interface Props {
  venceEl: string
  hoy: string
  onClick?: () => void
}

/**
 * La fecha de vencimiento del reintegro con el color de urgencia: rojo si falta una semana o
 * menos (o ya venció), naranja hasta 15 días, neutro si hay tiempo. Un vistazo alcanza.
 */
export default function VencimientoChip({ venceEl, hoy, onClick }: Props) {
  const est = estadoVencimiento(venceEl, hoy)
  if (!est) return null
  return (
    <Chip
      size="small"
      color={COLOR[est.nivel]}
      variant={est.nivel === 'ok' ? 'outlined' : 'filled'}
      icon={est.nivel === 'vencido' ? <EventBusyIcon /> : <EventIcon />}
      label={`${fmtFecha(venceEl)} · ${textoDias(est.dias)}`}
      onClick={onClick}
    />
  )
}
