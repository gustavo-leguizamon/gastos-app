'use client'

import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import AppSelect from '@/components/shared/AppSelect'
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
      const res = await fetch('/api/gastos/copiar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: gasto.id, mes, anio }),
      })
      if (!res.ok) throw new Error()
      const result = await res.json()
      if (result.merged) {
        toast.success(result.added_items > 0
          ? `El gasto ya existía: se agregaron ${result.added_items} sub-item(s) a ${MESES[mes - 1]} ${anio}`
          : `El gasto ya existía en ${MESES[mes - 1]} ${anio}, sin sub-items nuevos para agregar`)
      } else {
        toast.success(`Gasto copiado a ${MESES[mes - 1]} ${anio}`)
      }
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
          <AppSelect
            label="Mes"
            options={MESES.map((nombre, i) => ({ value: i + 1, label: nombre }))}
            value={mes}
            onChange={(v) => setMes(Number(v))}
            disableClearable
            sx={{ flex: 1 }}
          />
          <AppSelect
            label="Año"
            options={years.map(y => ({ value: y, label: String(y) }))}
            value={anio}
            onChange={(v) => setAnio(Number(v))}
            disableClearable
            sx={{ width: 100 }}
          />
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
