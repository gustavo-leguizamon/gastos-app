'use client'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import type { Reporte } from '@/lib/types'
import { fmtARS } from './vizConfig'

interface Props {
  reporte: Reporte
}

export default function ReporteKpis({ reporte }: Props) {
  const { kpis } = reporte
  const tiles = [
    { label: 'Total gastado', value: fmtARS(kpis.total), color: 'primary.main' },
    { label: 'Promedio mensual', value: fmtARS(kpis.promedio_mensual) },
    { label: 'Cantidad de gastos', value: String(kpis.cantidad_gastos) },
    { label: 'Meses analizados', value: String(kpis.meses) },
  ]

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
        </Card>
      ))}
    </Box>
  )
}
