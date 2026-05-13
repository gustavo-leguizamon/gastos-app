'use client'

import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import toast from 'react-hot-toast'
import type { Gasto, Pago } from '@/lib/types'

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

interface Props {
  open: boolean
  gasto: Gasto | null
  onClose: () => void
  onChanged: () => void
}

export default function PagoDialog({ open, gasto, onClose, onChanged }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [fecha, setFecha] = useState(today)
  const [monto, setMonto] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  if (!gasto) return null

  const pagos: Pago[] = gasto.pagos ?? []
  const totalPagado = pagos.reduce((s, p) => s + p.monto, 0)
  const restante = gasto.total_ars - totalPagado

  const handleAdd = async () => {
    const montoNum = parseFloat(monto)
    if (!fecha || isNaN(montoNum) || montoNum <= 0) {
      toast.error('Ingresá una fecha y un monto válido')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/gastos/${gasto.id}/pagos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, monto: montoNum }),
      })
      if (!res.ok) throw new Error()
      toast.success('Pago registrado')
      setMonto('')
      setFecha(today)
      onChanged()
    } catch {
      toast.error('Error al registrar el pago')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (pagoId: number) => {
    setDeletingId(pagoId)
    try {
      const res = await fetch(`/api/gastos/${gasto.id}/pagos/${pagoId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Pago eliminado')
      onChanged()
    } catch {
      toast.error('Error al eliminar el pago')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Pagos — {gasto.descripcion}
      </DialogTitle>

      <DialogContent dividers>
        {/* Resumen */}
        <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Total</Typography>
            <Typography fontWeight={700}>{fmtARS(gasto.total_ars)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Pagado</Typography>
            <Typography fontWeight={700} color="success.main">{fmtARS(totalPagado)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Restante</Typography>
            <Typography fontWeight={700} color={restante > 0 ? 'warning.main' : 'success.main'}>
              {fmtARS(restante)}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Lista de pagos */}
        {pagos.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            No hay pagos registrados aún.
          </Typography>
        ) : (
          <Box sx={{ mb: 2 }}>
            {pagos.map(p => (
              <Box
                key={p.id}
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <Typography variant="body2" color="text.secondary">{p.fecha}</Typography>
                  <Typography variant="body2" fontWeight={600}>{fmtARS(p.monto)}</Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => handleDelete(p.id)}
                  disabled={deletingId === p.id}
                >
                  {deletingId === p.id
                    ? <CircularProgress size={14} />
                    : <DeleteIcon fontSize="small" />}
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />

        {/* Formulario nuevo pago */}
        <Typography variant="subtitle2" fontWeight={700} mb={1}>Registrar pago</Typography>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          <TextField
            size="small"
            label="Fecha"
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            onClick={e => (e.currentTarget.querySelector('input') as any)?.showPicker?.()}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
          <TextField
            size="small"
            label="Monto (ARS)"
            type="number"
            value={monto}
            onChange={e => setMonto(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            inputProps={{ min: 0.01, step: 0.01 }}
            sx={{ flex: 1 }}
          />
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
            onClick={handleAdd}
            disabled={saving}
            sx={{ height: 40 }}
          >
            Agregar
          </Button>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}
