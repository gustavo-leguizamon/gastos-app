'use client'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import { BarChart } from '@mui/x-charts/BarChart'
import { CATEGORICAL, fmtARS, fmtARSCompact } from './vizConfig'
import type { ReporteMes } from '@/lib/types'

interface Props {
  data: ReporteMes[]
}

export default function ReporteMensualChart({ data }: Props) {
  const hayDatos = data.some((d) => d.total_ars !== 0)

  return (
    <Card variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, height: '100%' }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
        Evolución mensual
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Total gastado por mes en el período
      </Typography>

      {!hayDatos ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 280 }}>
          <Typography color="text.secondary" variant="body2">Sin gastos en el período.</Typography>
        </Box>
      ) : (
        <BarChart
          height={280}
          borderRadius={4}
          xAxis={[{ scaleType: 'band', data: data.map((d) => d.label) }]}
          yAxis={[{ valueFormatter: fmtARSCompact }]}
          series={[{
            data: data.map((d) => d.total_ars),
            label: 'Total ARS',
            color: CATEGORICAL[0],
            valueFormatter: (v) => (v == null ? '—' : fmtARS(v)),
          }]}
          margin={{ left: 58, right: 12, top: 12, bottom: 28 }}
          grid={{ horizontal: true }}
          slotProps={{ legend: { hidden: true } }}
        />
      )}
    </Card>
  )
}
