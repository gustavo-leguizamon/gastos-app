'use client'

import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import toast from 'react-hot-toast'
import type { Gasto } from '@/lib/types'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

interface Props {
  open: boolean
  gasto: Gasto | null
  onClose: () => void
  onCopied: () => void
}

export default function CopiarGastoDialog({ open, gasto, onClose, onCopied }: Props) {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [loading, setLoading] = useState(false)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  if (!gasto) return null

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i)

  const handleCopy = async () => {
    setLoading(true)
    try {
      // Calcular nueva fecha de vencimiento con el mismo día pero nuevo mes/año
      const diaVenc = gasto.fecha_vencimiento.split('-')[2]
      const nuevaFecha = `${anio}-${String(mes).padStart(2, '0')}-${diaVenc}`

      const res = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          casa_id: gasto.casa_id,
          descripcion: gasto.descripcion,
          fecha_vencimiento: nuevaFecha,
          tipo_pago: gasto.tipo_pago,
          moneda_id: gasto.moneda_id,
          tipo_cambio: gasto.tipo_cambio,
          total_moneda: gasto.total_moneda,
          total_pagado: 0,
          pasaje_mes_siguiente: 0,
          prestamo_a_otro: 0,
          tarjeta_id: gasto.tarjeta_id,
          cuota_actual: gasto.cuota_actual,
          cuotas_totales: gasto.cuotas_totales,
          mes,
          anio,
          notas: gasto.notas ?? '',
          confirmado: false,
          categoria_id: gasto.categoria_id,
          es_tarjeta: gasto.es_tarjeta,
          fecha_cierre: gasto.fecha_cierre,
          fecha_proximo_cierre: gasto.fecha_proximo_cierre,
        }),
      })
      if (!res.ok) throw new Error()
      const nuevoGasto = await res.json()

      // Copiar sub-items si existen
      if (gasto.items?.length) {
        await Promise.all(gasto.items.map(item =>
          fetch(`/api/gastos/${nuevoGasto.id}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              descripcion: item.descripcion,
              monto: item.monto,
              fecha: item.fecha,
              cuota_actual: item.cuota_actual,
              cuotas_totales: item.cuotas_totales,
              incluye_en_total: item.incluye_en_total,
              incluye_en_vencimiento: item.incluye_en_vencimiento,
              categoria_id: item.categoria_id,
            }),
          })
        ))
      }

      toast.success(`Gasto copiado a ${MESES[mes - 1]} ${anio}`)
      onClose()
      onCopied()
    } catch {
      toast.error('Error al copiar el gasto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
        <ContentCopyIcon color="primary" />
        Copiar gasto
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Copiando: <strong>{gasto.descripcion}</strong>
          {gasto.items?.length > 0 && ` (+ ${gasto.items.length} sub-item${gasto.items.length !== 1 ? 's' : ''})`}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          Los pagos no se copian. Los campos "total pagado", "pasaje" y "préstamo" se resetean a 0.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>Mes</InputLabel>
            <Select value={mes} label="Mes" onChange={e => setMes(Number(e.target.value))}>
              {MESES.map((nombre, i) => (
                <MenuItem key={i + 1} value={i + 1}>{nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ width: 100 }}>
            <InputLabel>Año</InputLabel>
            <Select value={anio} label="Año" onChange={e => setAnio(Number(e.target.value))}>
              {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleCopy}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ContentCopyIcon />}
        >
          Copiar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
