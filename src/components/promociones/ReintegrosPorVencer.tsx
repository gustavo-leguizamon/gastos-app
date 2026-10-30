'use client'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import AlarmIcon from '@mui/icons-material/Alarm'
import CheckIcon from '@mui/icons-material/Check'
import { estadoVencimiento } from '@/lib/promociones-compute'
import type { ReintegroPorVencer } from '@/lib/types'
import VencimientoChip from './VencimientoChip'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const fmtARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

interface Props {
  items: ReintegroPorVencer[]
  /** Fecha de hoy (`YYYY-MM-DD`, local). */
  hoy: string
  onEditar: (item: ReintegroPorVencer) => void
  onUsado: (item: ReintegroPorVencer) => void
}

/**
 * Lo primero que se ve en la pantalla: los reintegros con fecha de vencimiento que todavía no se
 * usaron, el más urgente arriba, con el color según los días que faltan. Es de **todos los
 * meses** (el reintegro de octubre puede vencer en diciembre), no sólo del que se está mirando.
 */
export default function ReintegrosPorVencer({ items, hoy, onEditar, onUsado }: Props) {
  if (items.length === 0) return null

  const total = items.reduce((s, i) => s + i.reintegrado, 0)
  // El borde toma el color del más urgente (la lista ya viene ordenada por fecha).
  const peor = estadoVencimiento(items[0].vence_el, hoy)?.nivel
  const borde = peor === 'vencido' || peor === 'urgente' ? 'error.main' : peor === 'proximo' ? 'warning.main' : 'divider'

  return (
    <Card variant="outlined" sx={{ borderColor: borde, borderWidth: borde === 'divider' ? 1 : 2 }}>
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          <AlarmIcon color={borde === 'error.main' ? 'error' : borde === 'warning.main' ? 'warning' : 'action'} />
          <Typography variant="subtitle1" fontWeight={800}>Reintegros para usar antes de que venzan</Typography>
          <Typography variant="body2" color="text.secondary">· {fmtARS(total)} en juego</Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {items.map(i => (
            <Box
              key={`${i.promocion_id}-${i.anio}-${i.mes}`}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}
            >
              <Typography fontWeight={700} sx={{ minWidth: 120 }}>{i.lugar}</Typography>
              <Typography fontWeight={800} color="primary.main">{fmtARS(i.reintegrado)}</Typography>
              <Typography variant="caption" color="text.secondary">
                de {MESES[i.mes - 1]} {i.anio}
              </Typography>
              <VencimientoChip venceEl={i.vence_el as string} hoy={hoy} onClick={() => onEditar(i)} />
              <Button size="small" startIcon={<CheckIcon />} onClick={() => onUsado(i)} sx={{ ml: 'auto' }}>
                Ya lo usé
              </Button>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  )
}
