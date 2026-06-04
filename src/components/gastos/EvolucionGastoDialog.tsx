'use client'

import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import { LineChart } from '@mui/x-charts/LineChart'
import AppSelect from '@/components/shared/AppSelect'
import type { Gasto } from '@/lib/types'

interface EvolucionPunto {
  mes: number
  anio: number
  label: string
  total_ars: number
}

interface Props {
  open: boolean
  gasto: Gasto | null
  mes: number
  anio: number
  onClose: () => void
}

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

const MESES_OPCIONES = [3, 6, 9, 12, 18, 24]

export default function EvolucionGastoDialog({ open, gasto, mes, anio, onClose }: Props) {
  const [meses, setMeses] = useState(6)
  const [data, setData] = useState<EvolucionPunto[]>([])
  const [loading, setLoading] = useState(false)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  useEffect(() => {
    if (!open || !gasto) return
    setLoading(true)
    const params = new URLSearchParams({
      descripcion: gasto.descripcion,
      mes: String(mes),
      anio: String(anio),
      meses: String(meses),
      ...(gasto.casa_id ? { casa_id: String(gasto.casa_id) } : {}),
    })
    fetch(`/api/gastos/evolucion?${params}`)
      .then(r => r.json())
      .then((d: EvolucionPunto[]) => setData(Array.isArray(d) ? d : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [open, gasto, mes, anio, meses])

  if (!gasto) return null

  const valores = data.map(d => d.total_ars)
  const conDatos = valores.filter(v => v > 0)
  const promedio = conDatos.length ? conDatos.reduce((s, v) => s + v, 0) / conDatos.length : 0
  const maximo = conDatos.length ? Math.max(...conDatos) : 0
  const minimo = conDatos.length ? Math.min(...conDatos) : 0

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
        <ShowChartIcon color="primary" />
        Evolución del gasto
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2, mb: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary">
              Evolución de <strong style={{ color: theme.palette.text.primary }}>{gasto.descripcion}</strong>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total ARS mes a mes{gasto.casa_nombre ? ` · ${gasto.casa_nombre}` : ''}
            </Typography>
          </Box>
          <AppSelect
            label="Meses a mostrar"
            options={MESES_OPCIONES.map(m => ({ value: m, label: `Últimos ${m} meses` }))}
            value={meses}
            onChange={(v) => setMeses(Number(v))}
            disableClearable
            sx={{ width: { xs: '100%', sm: 200 } }}
          />
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
            <CircularProgress />
          </Box>
        ) : conDatos.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
            <Typography color="text.secondary">No hay datos de este gasto en el período seleccionado.</Typography>
          </Box>
        ) : (
          <>
            <LineChart
              height={320}
              xAxis={[{
                scaleType: 'point',
                data: data.map(d => d.label),
              }]}
              series={[{
                data: valores,
                label: 'Total ARS',
                color: theme.palette.primary.main,
                curve: 'monotoneX',
                showMark: true,
                valueFormatter: (v) => v == null ? '—' : fmtARS(v),
              }]}
              yAxis={[{ valueFormatter: (v: number) => fmtARS(v) }]}
              margin={{ left: 70, right: 20, top: 20, bottom: 30 }}
              grid={{ horizontal: true }}
            />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center', mt: 1 }}>
              <Stat label="Promedio" value={fmtARS(promedio)} />
              <Stat label="Máximo" value={fmtARS(maximo)} color="#f59e0b" />
              <Stat label="Mínimo" value={fmtARS(minimo)} color="#22c55e" />
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
      <Typography variant="body2" fontWeight={700} sx={{ color }}>{value}</Typography>
    </Box>
  )
}
