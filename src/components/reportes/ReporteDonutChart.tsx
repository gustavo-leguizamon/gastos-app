'use client'

import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import { PieChart } from '@mui/x-charts/PieChart'
import { fmtARS } from './vizConfig'

export interface DonutSlice {
  id: string
  label: string
  value: number
  color: string
}

interface Props {
  title: string
  subtitle?: string
  slices: DonutSlice[]
  emptyText?: string
}

/**
 * Donut genérico con leyenda propia (swatch + nombre + monto + %). Recibe los slices
 * ya armados con su color; el caller decide agrupamiento/colores. Usado por los charts
 * de categoría y tipo de pago.
 */
export default function ReporteDonutChart({ title, subtitle, slices, emptyText }: Props) {
  const total = useMemo(() => slices.reduce((s, x) => s + x.value, 0), [slices])

  return (
    <Card variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, height: '100%' }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: subtitle ? 0.5 : 2 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          {subtitle}
        </Typography>
      )}

      {slices.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 260 }}>
          <Typography color="text.secondary" variant="body2">{emptyText ?? 'Sin datos en el período.'}</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: { xs: '100%', sm: 260 }, flexShrink: 0 }}>
            <PieChart
              height={260}
              series={[{
                data: slices,
                innerRadius: 62,
                paddingAngle: 2,
                cornerRadius: 4,
                arcLabel: (item) => (total > 0 && item.value / total >= 0.08 ? `${Math.round((item.value / total) * 100)}%` : ''),
                arcLabelMinAngle: 24,
                highlightScope: { faded: 'global', highlighted: 'item' },
                valueFormatter: (v) => fmtARS(v.value),
              }]}
              margin={{ top: 8, bottom: 8, left: 8, right: 8 }}
              slotProps={{ legend: { hidden: true } }}
              sx={{ '& .MuiPieArcLabel-root': { fontSize: 12, fontWeight: 700, fill: '#fff' } }}
            />
          </Box>

          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {slices.map((s) => (
              <Box component="li" key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: s.color, flexShrink: 0 }} />
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.label}
                </Typography>
                <Typography variant="body2" fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {fmtARS(s.value)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ width: 40, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {total > 0 ? `${Math.round((s.value / total) * 100)}%` : ''}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Card>
  )
}
