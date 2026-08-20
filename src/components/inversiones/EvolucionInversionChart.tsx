'use client'

import { useMemo } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import { LineChart } from '@mui/x-charts/LineChart'

interface Props {
  /** Puntos en orden cronológico (`serieEvolucion`). */
  serie: { fecha: string; saldo: number }[]
  /** Símbolo de la moneda de la inversión. */
  simbolo: string
}

/** `2026-06-10` → `10/06`. La fecha se parte como string: `new Date()` correría el día. */
function labelFecha(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  return m ? `${m[3]}/${m[2]}` : fecha
}

/**
 * Evolución del saldo de una inversión. Los datos ya estaban cargados y `@mui/x-charts` ya
 * era dependencia (lo usa la evolución del gasto y los reportes), pero la sección era sólo
 * una grilla de números: no había forma de ver la curva.
 */
export default function EvolucionInversionChart({ serie, simbolo }: Props) {
  const { labels, valores } = useMemo(() => ({
    labels: serie.map((p) => labelFecha(p.fecha)),
    valores: serie.map((p) => p.saldo),
  }), [serie])

  // Con menos de dos puntos no hay curva que mostrar, sólo un punto suelto.
  if (serie.length < 2) return null

  const fmt = (v: number | null) =>
    v == null ? '' : `${simbolo} ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(v)}`

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
          Evolución del saldo
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Saldo después de aplicar cada depósito o retiro
        </Typography>
        <Box sx={{ width: '100%' }}>
          <LineChart
            height={260}
            series={[{ data: valores, label: 'Saldo', curve: 'monotoneX', valueFormatter: fmt }]}
            xAxis={[{ scaleType: 'point', data: labels }]}
            yAxis={[{ valueFormatter: (v: number) => new Intl.NumberFormat('es-AR', { notation: 'compact' }).format(v) }]}
            margin={{ left: 70, right: 20, top: 20, bottom: 30 }}
            slotProps={{ legend: { hidden: true } }}
          />
        </Box>
      </CardContent>
    </Card>
  )
}
