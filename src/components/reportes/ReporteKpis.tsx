'use client'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import type { Reporte } from '@/lib/types'
import { fmtARS } from './vizConfig'

interface Props {
  reporte: Reporte
}

/**
 * Variación contra el período anterior. Más gasto es peor, así que el signo positivo va en
 * rojo — al revés de lo que uno esperaría de un "+" en verde.
 */
function Variacion({ pct, previo }: { pct: number | null; previo: number | null }) {
  if (pct === null || previo === null) return null
  const sube = pct > 0
  const color = Math.abs(pct) < 0.05 ? 'text.secondary' : sube ? '#ef4444' : '#22c55e'
  const signo = sube ? '+' : ''
  return (
    <Typography variant="caption" sx={{ color, display: 'block', mt: 0.5, fontWeight: 600 }}>
      {signo}{pct.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%{' '}
      <Typography component="span" variant="caption" color="text.secondary" fontWeight={400}>
        vs. {fmtARS(previo)} del período anterior
      </Typography>
    </Typography>
  )
}

export default function ReporteKpis({ reporte }: Props) {
  const { kpis } = reporte
  const tiles = [
    {
      label: 'Total gastado',
      value: fmtARS(kpis.total),
      color: 'primary.main',
      extra: <Variacion pct={kpis.variacion_pct} previo={kpis.total_previo} />,
    },
    { label: 'Promedio mensual', value: fmtARS(kpis.promedio_mensual) },
    { label: 'Cantidad de gastos', value: String(kpis.cantidad_gastos) },
    { label: 'Meses analizados', value: String(kpis.meses) },
  ] as { label: string; value: string; color?: string; extra?: JSX.Element | null }[]

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        gap: { xs: 1.5, sm: 2 },
        mb: { xs: 2, sm: 3 },
      }}
    >
      {tiles.map((t) => (
        <Card key={t.label} variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            {t.label}
          </Typography>
          <Typography variant="h6" fontWeight={700} sx={{ color: t.color, lineHeight: 1.2 }}>
            {t.value}
          </Typography>
          {t.extra}
        </Card>
      ))}
    </Box>
  )
}
