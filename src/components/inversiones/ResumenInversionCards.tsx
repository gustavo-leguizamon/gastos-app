'use client'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { ResumenInversion } from '@/lib/inversiones-compute'

interface Props {
  resumen: ResumenInversion
  /** Símbolo de la moneda de la inversión (`$` si no declaró ninguna). */
  simbolo: string
}

function fmt(n: number, simbolo: string) {
  return `${simbolo} ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)}`
}

/**
 * Cuatro tiles con el estado de la inversión. Lo importante es la separación entre
 * **aportado** y **ganancia**: la pantalla sólo mostraba el cambio de saldo, que sube igual
 * si depositás plata que si la inversión rinde — y son cosas distintas.
 */
export default function ResumenInversionCards({ resumen, simbolo }: Props) {
  const positivo = resumen.ganancia_total >= 0
  const colorGanancia = resumen.ganancia_total === 0 ? 'text.primary' : positivo ? 'success.main' : 'error.main'
  const signo = resumen.ganancia_total > 0 ? '+' : ''

  const tiles = [
    { label: 'Saldo actual', value: fmt(resumen.saldo_actual, simbolo), color: 'primary.main' as const, tip: 'Saldo del último movimiento cargado' },
    { label: 'Aportado', value: fmt(resumen.aportado, simbolo), tip: 'Depósitos menos retiros, sin contar lo que rindió' },
    {
      label: 'Ganancia',
      value: `${signo}${fmt(resumen.ganancia_total, simbolo)}`,
      color: colorGanancia,
      tip: 'Lo que generó la inversión: la variación del saldo descontando aportes y retiros',
    },
    {
      label: 'Rendimiento',
      value: resumen.rendimiento_pct === null
        ? '—'
        : `${resumen.rendimiento_pct > 0 ? '+' : ''}${resumen.rendimiento_pct.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`,
      color: colorGanancia,
      tip: 'Ganancia sobre el capital expuesto (saldo inicial + aportes posteriores)',
    },
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
        <Tooltip key={t.label} title={t.tip}>
          <Card variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              {t.label}
            </Typography>
            <Typography variant="h6" fontWeight={700} sx={{ color: t.color, lineHeight: 1.2 }}>
              {t.value}
            </Typography>
          </Card>
        </Tooltip>
      ))}
    </Box>
  )
}
