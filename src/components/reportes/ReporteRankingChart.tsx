'use client'

import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import { BarChart } from '@mui/x-charts/BarChart'
import { fmtARS, fmtARSCompact } from './vizConfig'

export interface RankingItem {
  label: string
  total_ars: number
}

interface Props {
  title: string
  subtitle?: string
  data: RankingItem[]
  color: string
  emptyText?: string
}

/**
 * Ranking horizontal genérico (barras). Muestra sólo montos positivos, de mayor a
 * menor con el mayor arriba. Usado por los charts de conceptos y tarjetas.
 */
export default function ReporteRankingChart({ title, subtitle, data, color, emptyText }: Props) {
  // En barras horizontales el primer item queda abajo → invertimos para el mayor arriba.
  const orden = useMemo(() => data.filter((d) => d.total_ars > 0).slice().reverse(), [data])
  const height = Math.max(200, orden.length * 40 + 60)

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

      {orden.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <Typography color="text.secondary" variant="body2">{emptyText ?? 'Sin gastos en el período.'}</Typography>
        </Box>
      ) : (
        <BarChart
          height={height}
          layout="horizontal"
          borderRadius={4}
          xAxis={[{ valueFormatter: fmtARSCompact }]}
          yAxis={[{ scaleType: 'band', data: orden.map((d) => d.label), tickLabelStyle: { fontSize: 12 } }]}
          series={[{
            data: orden.map((d) => d.total_ars),
            label: 'Total ARS',
            color,
            valueFormatter: (v) => (v == null ? '—' : fmtARS(v)),
          }]}
          margin={{ left: 130, right: 16, top: 8, bottom: 28 }}
          grid={{ vertical: true }}
          slotProps={{ legend: { hidden: true } }}
        />
      )}
    </Card>
  )
}
