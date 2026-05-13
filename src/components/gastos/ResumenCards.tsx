'use client'

import { useEffect, useState } from 'react'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import TodayIcon from '@mui/icons-material/Today'
import type { Resumen, FiltrosGastos } from '@/lib/types'

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

const CARDS = [
  {
    key: 'total_gastos' as const,
    label: 'Total Gastos',
    icon: <TrendingUpIcon />,
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.12)',
  },
  {
    key: 'total_restante' as const,
    label: 'Restante',
    icon: <AccountBalanceIcon />,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
  },
  {
    key: 'total_pagado' as const,
    label: 'Pagado',
    icon: <CheckCircleIcon />,
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.12)',
  },
  {
    key: 'pagar_hoy' as const,
    label: 'Pagar Hoy',
    icon: <TodayIcon />,
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
  },
]

interface Props {
  filtros: FiltrosGastos
  refreshKey: number
}

export default function ResumenCards({ filtros, refreshKey }: Props) {
  const [resumen, setResumen] = useState<Resumen>({ total_gastos: 0, total_restante: 0, total_pagado: 0, pagar_hoy: 0 })

  useEffect(() => {
    const params = new URLSearchParams({
      mes: String(filtros.mes),
      anio: String(filtros.anio),
      ...(filtros.casa_id ? { casa_id: String(filtros.casa_id) } : {}),
    })
    fetch(`/api/resumen?${params}`)
      .then((r) => r.json())
      .then(setResumen)
  }, [filtros, refreshKey])

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {CARDS.map((card) => (
        <Grid item xs={12} sm={6} md={3} key={card.key}>
          <Card sx={{ border: `1px solid ${card.color}33` }}>
            <CardContent sx={{ pb: '16px !important' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  {card.label}
                </Typography>
                <Box sx={{ color: card.color, bgcolor: card.bg, borderRadius: 2, p: 0.8, display: 'flex' }}>
                  {card.icon}
                </Box>
              </Box>
              <Typography variant="h6" fontWeight={700} sx={{ color: card.color }}>
                {formatARS(resumen[card.key])}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
}
