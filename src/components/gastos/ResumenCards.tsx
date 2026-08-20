'use client'

import { useEffect, useState } from 'react'
import { useGastosStore } from '@/store/gastosStore'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActionArea from '@mui/material/CardActionArea'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import TodayIcon from '@mui/icons-material/Today'
import EventRepeatIcon from '@mui/icons-material/EventRepeat'
import PaymentsIcon from '@mui/icons-material/Payments'
import SavingsIcon from '@mui/icons-material/Savings'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import IngresosDialog from '@/components/ingresos/IngresosDialog'
import type { Resumen, FiltrosGastos } from '@/lib/types'

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

type CardDef = {
  key: keyof Resumen
  label: string
  icon: JSX.Element
  color: string
  bg: string
  /** La card no se renderiza cuando el valor es 0 (evita ocupar lugar sin decir nada). */
  soloSiHayValor?: boolean
}

const CARDS: CardDef[] = [
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
  // Lo que ya venció y sigue impago. Sólo aparece cuando hay algo atrasado: en un mes al día
  // una card en cero sería ruido, y cuando aparece tiene que llamar la atención.
  {
    key: 'total_vencido' as const,
    label: 'Vencido',
    icon: <ReportProblemIcon />,
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.12)',
    soloSiHayValor: true,
  },
  {
    key: 'total_proximo_mes' as const,
    label: 'Estimado próximo mes',
    icon: <EventRepeatIcon />,
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.12)',
  },
  // Ingresos del mes (suma de las entradas cargadas) y lo que queda de ellos una vez
  // descontado lo gastado en débito/efectivo. La card de Ingresos abre el ABM del mes.
  {
    key: 'total_ingresos' as const,
    label: 'Ingresos',
    icon: <PaymentsIcon />,
    color: '#14b8a6',
    bg: 'rgba(20,184,166,0.12)',
  },
  {
    key: 'total_ahorro' as const,
    label: 'Ahorro',
    icon: <SavingsIcon />,
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.12)',
  },
]

const RESUMEN_VACIO: Resumen = {
  total_gastos: 0,
  total_gastos_neto: 0,
  total_prestamos: 0,
  total_tarjetas: 0,
  total_pasajes: 0,
  total_restante: 0,
  total_restante_neto: 0,
  total_pagado: 0,
  pagar_hoy: 0,
  total_vencido: 0,
  total_proximo_mes: 0,
  total_ingresos: 0,
  total_debito: 0,
  total_ahorro: 0,
  ahorro_pct: 0,
}

interface Props {
  filtros: FiltrosGastos
  refreshKey: number
}

export default function ResumenCards({ filtros, refreshKey }: Props) {
  const resumenRefreshKey = useGastosStore(s => s.resumenRefreshKey)
  const triggerResumenRefresh = useGastosStore(s => s.triggerResumenRefresh)
  const [resumen, setResumen] = useState<Resumen>(RESUMEN_VACIO)
  const [ingresosOpen, setIngresosOpen] = useState(false)

  useEffect(() => {
    const d = new Date()
    const todayLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const params = new URLSearchParams({
      mes: String(filtros.mes),
      anio: String(filtros.anio),
      today: todayLocal,
      ...(filtros.casa_id ? { casa_id: String(filtros.casa_id) } : {}),
    })
    fetch(`/api/resumen?${params}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(setResumen)
  }, [filtros, refreshKey, resumenRefreshKey])

  // Sin ingresos cargados el "ahorro" sería sólo el débito en negativo — no informa nada.
  const hayIngresos = resumen.total_ingresos !== 0
  const ahorroColor = resumen.total_ahorro < 0 ? '#ef4444' : '#8b5cf6'

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {CARDS.filter((card) => !card.soloSiHayValor || resumen[card.key] !== 0).map((card) => {
          const esIngresos = card.key === 'total_ingresos'
          const esAhorro = card.key === 'total_ahorro'
          const color = esAhorro && hayIngresos ? ahorroColor : card.color

          const contenido = (
            <CardContent sx={{ pb: '16px !important' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  {card.label}
                </Typography>
                <Box sx={{ color: card.color, bgcolor: card.bg, borderRadius: 2, p: 0.8, display: 'flex' }}>
                  {card.icon}
                </Box>
              </Box>
              <Typography variant="h6" fontWeight={700} sx={{ color }}>
                {esAhorro && !hayIngresos ? '—' : formatARS(resumen[card.key])}
              </Typography>
              {esIngresos && (
                <Box sx={{ mt: 0.5, pt: 0.5, borderTop: `1px solid ${card.color}33` }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {hayIngresos ? 'Tocá para editar los ingresos del mes' : 'Tocá para cargar los ingresos del mes'}
                  </Typography>
                </Box>
              )}
              {esAhorro && (
                <Box sx={{ mt: 0.5, pt: 0.5, borderTop: `1px solid ${card.color}33` }}>
                  {hayIngresos ? (
                    <>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        <strong>{resumen.ahorro_pct.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%</strong> de lo ingresado
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Ingresos {formatARS(resumen.total_ingresos)} − débito {formatARS(resumen.total_debito)}
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Cargá los ingresos del mes para verlo
                    </Typography>
                  )}
                </Box>
              )}
              {card.key === 'total_vencido' && (
                <Box sx={{ mt: 0.5, pt: 0.5, borderTop: `1px solid ${card.color}33` }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Pasó la fecha y sigue impago, dentro de este mes
                  </Typography>
                </Box>
              )}
              {card.key === 'total_restante' && resumen.total_pasajes > 0 && (
                <Box sx={{ mt: 0.5, pt: 0.5, borderTop: `1px solid ${card.color}33` }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Neto: <strong>{formatARS(resumen.total_restante_neto)}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Pasajes mes sig.: {formatARS(resumen.total_pasajes)}
                  </Typography>
                </Box>
              )}
              {card.key === 'total_gastos' && (resumen.total_prestamos > 0 || resumen.total_tarjetas > 0 || resumen.total_pasajes > 0) && (
                <Box sx={{ mt: 0.5, pt: 0.5, borderTop: `1px solid ${card.color}33` }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Neto: <strong>{formatARS(resumen.total_gastos_neto)}</strong>
                  </Typography>
                  {resumen.total_prestamos > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Préstamos: {formatARS(resumen.total_prestamos)}
                    </Typography>
                  )}
                  {resumen.total_tarjetas > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Tarjetas: {formatARS(resumen.total_tarjetas)}
                    </Typography>
                  )}
                  {resumen.total_pasajes > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Pasajes mes sig.: {formatARS(resumen.total_pasajes)}
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          )

          return (
            <Grid item xs={12} sm={6} md={3} key={card.key}>
              <Card sx={{ border: `1px solid ${color}33`, height: '100%' }}>
                {esIngresos ? (
                  <CardActionArea onClick={() => setIngresosOpen(true)} sx={{ height: '100%' }}>
                    {contenido}
                  </CardActionArea>
                ) : contenido}
              </Card>
            </Grid>
          )
        })}
      </Grid>

      <IngresosDialog
        open={ingresosOpen}
        filtros={filtros}
        onClose={() => setIngresosOpen(false)}
        onChanged={triggerResumenRefresh}
      />
    </>
  )
}
