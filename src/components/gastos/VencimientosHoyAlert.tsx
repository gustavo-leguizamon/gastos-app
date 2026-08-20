'use client'

import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight'
import { vencimientosPendientes, sumVencimientos } from '@/lib/vencimientos'
import type { VencimientoHoy } from '@/lib/vencimientos'
import { shiftMonth } from '@/lib/fechas'
import type { Gasto } from '@/lib/types'

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

const COLOR_HOY = '#f59e0b'
const COLOR_VENCIDO = '#dc2626'

export default function VencimientosHoyAlert() {
  const [pendientes, setPendientes] = useState<VencimientoHoy[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const mes = d.getMonth() + 1
    const anio = d.getFullYear()
    const prev = shiftMonth(mes, anio, -1)

    // Se pide también el mes anterior: un atraso de fin de mes no tiene que desaparecer
    // el día 1 sólo porque cambió el período que mira el dashboard. Mismo criterio que
    // el push diario (`/api/cron/vencimientos`).
    Promise.all([
      fetch(`/api/gastos?mes=${mes}&anio=${anio}`).then(r => r.json()),
      fetch(`/api/gastos?mes=${prev.mes}&anio=${prev.anio}`).then(r => r.json()),
    ])
      .then(([actual, anterior]: [Gasto[], Gasto[]]) => {
        const out = vencimientosPendientes([...(anterior ?? []), ...(actual ?? [])], today)
        if (out.length > 0) {
          setPendientes(out)
          setOpen(true)
        }
      })
      .catch(() => {})
  }, [])

  if (pendientes.length === 0) return null

  const vencidos = pendientes.filter(e => e.estado === 'vencido')
  const hoy = pendientes.filter(e => e.estado === 'hoy')
  const total = sumVencimientos(pendientes)
  const hayVencidos = vencidos.length > 0
  const colorTitulo = hayVencidos ? COLOR_VENCIDO : COLOR_HOY

  const renderEntrada = (e: VencimientoHoy) => {
    const color = e.estado === 'vencido' ? COLOR_VENCIDO : COLOR_HOY
    return (
      <Box
        key={e.key}
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
      >
        <Box sx={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          {e.tipo === 'subitem' && <SubdirectoryArrowRightIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {e.descripcion}
              {e.tipo === 'subitem' && e.parent && (
                <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 0.5 }}>
                  · {e.parent}
                </Typography>
              )}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography variant="caption" color="text.secondary">{e.casa_nombre}</Typography>
              {e.estado === 'vencido' && (
                <Chip
                  size="small"
                  label={e.dias_atraso === 1 ? 'hace 1 día' : `hace ${e.dias_atraso} días`}
                  sx={{ height: 18, fontSize: 11, color: COLOR_VENCIDO, bgcolor: 'rgba(220,38,38,0.12)' }}
                />
              )}
            </Box>
          </Box>
        </Box>
        <Typography variant="body2" fontWeight={700} sx={{ color, flexShrink: 0, ml: 2 }}>
          {fmtARS(e.monto)}
        </Typography>
      </Box>
    )
  }

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: colorTitulo }}>
        <WarningAmberIcon /> {hayVencidos ? 'Vencimientos pendientes' : 'Vencimientos del día'}
      </DialogTitle>
      <DialogContent dividers>
        {hayVencidos && (
          <>
            <Typography variant="body2" fontWeight={700} sx={{ color: COLOR_VENCIDO, mb: 1 }}>
              {vencidos.length === 1 ? 'Venció y sigue impago' : `${vencidos.length} vencidos y sin pagar`}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: hoy.length > 0 ? 2.5 : 0 }}>
              {vencidos.map(renderEntrada)}
            </Box>
          </>
        )}
        {hoy.length > 0 && (
          <>
            <Typography variant="body2" fontWeight={700} sx={{ color: COLOR_HOY, mb: 1 }}>
              {hoy.length === 1 ? 'Vence hoy' : `${hoy.length} vencen hoy`}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {hoy.map(renderEntrada)}
            </Box>
          </>
        )}
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" fontWeight={700}>Total pendiente</Typography>
          <Typography variant="body2" fontWeight={700} sx={{ color: colorTitulo }}>{fmtARS(total)}</Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpen(false)} variant="contained">Entendido</Button>
      </DialogActions>
    </Dialog>
  )
}
