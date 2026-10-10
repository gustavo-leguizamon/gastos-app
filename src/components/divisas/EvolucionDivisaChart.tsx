'use client'

import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import { LineChart } from '@mui/x-charts/LineChart'
import type { PuntoDivisa } from '@/lib/divisas-compute'
import { fmtArs, labelFecha } from './formato'

interface Props {
  /** Puntos en orden cronológico (`serieValorizada`). */
  serie: PuntoDivisa[]
}

/**
 * **Costo contra valor**, las dos en pesos. Ninguna de las dos sola dice nada: la tenencia en
 * dólares es plana aunque el tipo de cambio se duplique, y el valor en pesos sube aunque sólo
 * estés comprando más. La distancia entre las curvas es la ganancia (o la pérdida) latente.
 *
 * El valor arranca `null` mientras no haya una cotización cargada para esas fechas — el
 * gráfico deja el hueco en vez de dibujar una línea que nadie midió.
 */
export default function EvolucionDivisaChart({ serie }: Props) {
  const { labels, costo, valor } = useMemo(
    () => ({
      labels: serie.map((p) => labelFecha(p.fecha)),
      costo: serie.map((p) => p.costo),
      valor: serie.map((p) => p.valor),
    }),
    [serie],
  )

  // Con menos de dos puntos no hay curva que mostrar, sólo un punto suelto.
  if (serie.length < 2) return null

  const fmt = (v: number | null) => (v == null ? '' : fmtArs(v))

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
          Costo vs. valor en pesos
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Lo que pagaste por la tenencia contra lo que vale a la cotización de cada momento
        </Typography>
        <Box sx={{ width: '100%' }}>
          <LineChart
            height={280}
            series={[
              { data: costo, label: 'Costo', curve: 'stepAfter', valueFormatter: fmt, color: '#94a3b8' },
              { data: valor, label: 'Valor', curve: 'monotoneX', valueFormatter: fmt, connectNulls: true },
            ]}
            xAxis={[{ scaleType: 'point', data: labels }]}
            yAxis={[{ valueFormatter: (v: number) => new Intl.NumberFormat('es-AR', { notation: 'compact' }).format(v) }]}
            margin={{ left: 70, right: 20, top: 30, bottom: 30 }}
          />
        </Box>
      </CardContent>
    </Card>
  )
}
