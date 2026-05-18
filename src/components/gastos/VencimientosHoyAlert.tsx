'use client'

import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import type { Gasto } from '@/lib/types'

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

export default function VencimientosHoyAlert() {
  const [pendientes, setPendientes] = useState<Gasto[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const params = new URLSearchParams({ mes: String(d.getMonth() + 1), anio: String(d.getFullYear()) })
    fetch(`/api/gastos?${params}`)
      .then(r => r.json())
      .then((gastos: Gasto[]) => {
        const hoy = gastos.filter(g => g.fecha_vencimiento === today && g.total_restante > 0 && g.confirmado)
        if (hoy.length > 0) {
          setPendientes(hoy)
          setOpen(true)
        }
      })
      .catch(() => {})
  }, [])

  if (pendientes.length === 0) return null

  const total = pendientes.reduce((s, g) => s + g.total_restante, 0)

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: '#f59e0b' }}>
        <WarningAmberIcon /> Vencimientos del día
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Tenés {pendientes.length} gasto{pendientes.length !== 1 ? 's' : ''} con vencimiento hoy que aún {pendientes.length !== 1 ? 'no fueron saldados' : 'no fue saldado'}:
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {pendientes.map(g => (
            <Box key={g.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={600} noWrap>{g.descripcion}</Typography>
                <Typography variant="caption" color="text.secondary">{g.casa_nombre}</Typography>
              </Box>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#f59e0b', flexShrink: 0, ml: 2 }}>
                {fmtARS(g.total_restante)}
              </Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" fontWeight={700}>Total a pagar hoy</Typography>
          <Typography variant="body2" fontWeight={700} sx={{ color: '#f59e0b' }}>{fmtARS(total)}</Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpen(false)} variant="contained">Entendido</Button>
      </DialogActions>
    </Dialog>
  )
}
