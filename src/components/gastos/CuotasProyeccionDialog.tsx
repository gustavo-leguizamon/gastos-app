'use client'

import { useEffect, useMemo, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { BarChart } from '@mui/x-charts/BarChart'
import { CATEGORICAL, NEUTRAL_OTRAS, fmtARS, fmtARSCompact } from '@/components/reportes/vizConfig'
import type { FiltrosGastos } from '@/lib/types'
import type { CompraEnCuotas, ProyeccionCuotas } from '@/lib/cuotas-proyeccion'

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const etiquetaMes = (m: { mes: number; anio: number }) => `${MESES_CORTOS[m.mes - 1]} ${String(m.anio).slice(2)}`

interface Props {
  open: boolean
  filtros: FiltrosGastos
  onClose: () => void
}

export default function CuotasProyeccionDialog({ open, filtros, onClose }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [data, setData] = useState<ProyeccionCuotas | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Índice del mes elegido en el gráfico (null = todas las compras).
  const [mesSel, setMesSel] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    setMesSel(null)
    const params = new URLSearchParams({ mes: String(filtros.mes), anio: String(filtros.anio) })
    if (filtros.casa_id) params.set('casa_id', String(filtros.casa_id))
    fetch(`/api/tarjetas/cuotas-proyeccion?${params}`, { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? 'Error al cargar')
        return r.json()
      })
      .then((d: ProyeccionCuotas) => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [open, filtros.mes, filtros.anio, filtros.casa_id])

  // Una serie por tarjeta (apiladas), con color fijo por orden de aparición.
  const series = useMemo(() => {
    if (!data) return []
    const tarjetas = Array.from(new Set(data.compras.map(c => c.tarjeta)))
    return tarjetas.map((t, i) => ({
      label: t,
      stack: 'total',
      color: i < CATEGORICAL.length ? CATEGORICAL[i] : NEUTRAL_OTRAS,
      valueFormatter: (v: number | null) => (v == null ? '—' : fmtARS(v)),
      data: data.meses.map(m =>
        data.compras
          .filter(c => c.tarjeta === t && c.cuotas.some(q => q.mes === m.mes && q.anio === m.anio))
          .reduce((s, c) => s + c.monto, 0),
      ),
    }))
  }, [data])

  const mesElegido = data && mesSel !== null ? data.meses[mesSel] : null
  const compras: CompraEnCuotas[] = !data
    ? []
    : mesElegido
      ? data.compras.filter(c => c.cuotas.some(q => q.mes === mesElegido.mes && q.anio === mesElegido.anio))
      : data.compras

  const cuotaEn = (c: CompraEnCuotas) =>
    mesElegido ? c.cuotas.find(q => q.mes === mesElegido.mes && q.anio === mesElegido.anio)?.cuota : c.cuotas[0]?.cuota

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={isMobile}>
      <DialogTitle sx={{ pb: 1 }}>
        Cuotas de tarjeta comprometidas
        <Typography variant="body2" color="text.secondary">
          Desde {etiquetaMes(filtros)} hasta la última cuota · proyectado desde los resúmenes cargados
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {error && <Typography color="error">{error}</Typography>}
        {!loading && data && data.compras.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No hay cuotas pendientes en los resúmenes de tarjeta.
          </Typography>
        )}
        {!loading && data && data.compras.length > 0 && (
          <>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Card variant="outlined" sx={{ px: 2, py: 1, flex: '1 1 160px' }}>
                <Typography variant="caption" color="text.secondary">Este mes</Typography>
                <Typography variant="h6" fontWeight={700}>{fmtARS(data.meses[0]?.total ?? 0)}</Typography>
              </Card>
              <Card variant="outlined" sx={{ px: 2, py: 1, flex: '1 1 160px' }}>
                <Typography variant="caption" color="text.secondary">Próximo mes</Typography>
                <Typography variant="h6" fontWeight={700}>{fmtARS(data.meses[1]?.total ?? 0)}</Typography>
              </Card>
              <Card variant="outlined" sx={{ px: 2, py: 1, flex: '1 1 160px' }}>
                <Typography variant="caption" color="text.secondary">
                  Resta pagar después de este mes
                </Typography>
                <Typography variant="h6" fontWeight={700}>{fmtARS(data.total_futuro)}</Typography>
              </Card>
            </Box>

            <BarChart
              height={isMobile ? 220 : 260}
              borderRadius={4}
              xAxis={[{ scaleType: 'band', data: data.meses.map(etiquetaMes) }]}
              yAxis={[{ valueFormatter: fmtARSCompact }]}
              series={series}
              margin={{ left: 58, right: 12, top: series.length > 1 ? 40 : 12, bottom: 28 }}
              grid={{ horizontal: true }}
              slotProps={{
                legend: {
                  hidden: series.length <= 1,
                  direction: 'row',
                  position: { vertical: 'top', horizontal: 'middle' },
                  itemMarkWidth: 10,
                  itemMarkHeight: 10,
                  labelStyle: { fontSize: 11 },
                },
              }}
              onAxisClick={(_e, d) => {
                const i = d?.dataIndex
                if (i == null) return
                setMesSel(prev => (prev === i ? null : i))
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Tocá un mes del gráfico para ver qué cuotas lo componen.
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                {mesElegido
                  ? `Cuotas de ${etiquetaMes(mesElegido)} · ${fmtARS(mesElegido.total)}`
                  : `Compras en cuotas (${data.compras.length})`}
              </Typography>
              {mesElegido && (
                <Chip size="small" label="Ver todas" onClick={() => setMesSel(null)} onDelete={() => setMesSel(null)} />
              )}
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {compras.map(c => {
                const cuota = cuotaEn(c) ?? 0
                const pagadas = cuota - 1
                return (
                  <Card key={c.key} variant="outlined" sx={{ px: 1.5, py: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700} noWrap>{c.concepto}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {c.tarjeta} · cuota {cuota}/{c.cuotas_totales} · termina {etiquetaMes(c.ultima)}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                        <Typography variant="body2" fontWeight={700}>{fmtARS(c.monto)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          resta {fmtARS(c.pendiente)}
                        </Typography>
                      </Box>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(pagadas / c.cuotas_totales) * 100}
                      sx={{ height: 4, borderRadius: 2, mt: 0.75 }}
                    />
                  </Card>
                )
              })}
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              Sólo cuenta las cuotas que ya están como sub-ítems de un resumen de tarjeta (las compras con crédito
              sin pago registrado todavía no aparecen). No incluye consumos sin cuotas ni cargos del banco.
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}
