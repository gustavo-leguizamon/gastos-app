'use client'

import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@/components/shared/AppTextField'
import AppDateField from '@/components/shared/AppDateField'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import toast from 'react-hot-toast'
import type { Gasto, Pago } from '@/lib/types'

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type EditState = { id: number; fecha: string; monto: string }

interface Props {
  open: boolean
  gasto: Gasto | null
  onClose: () => void
  onChanged: (fullReload?: boolean) => void
}

export default function PagoDialog({ open, gasto, onClose, onChanged }: Props) {
  const [fecha, setFecha] = useState(localToday())
  const [monto, setMonto] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editing, setEditing] = useState<EditState | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  if (!gasto) return null

  const pagos: Pago[] = gasto.pagos ?? []
  const totalPagado = pagos.reduce((s, p) => s + p.monto, 0)
  const restante = gasto.total_ars - totalPagado

  const startEdit = (p: Pago) => setEditing({ id: p.id, fecha: p.fecha, monto: String(p.monto) })

  const handleSaveEdit = async () => {
    if (!editing) return
    const montoNum = parseFloat(editing.monto)
    if (!editing.fecha || isNaN(montoNum) || montoNum === 0) { toast.error('Fecha y monto válidos requeridos'); return }
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/gastos/${gasto.id}/pagos/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: editing.fecha, monto: montoNum }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      toast.success('Pago actualizado')
      setEditing(null)
      onChanged(updated?.synced_items > 0)
    } catch {
      toast.error('Error al actualizar el pago')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleAdd = async () => {
    const montoNum = parseFloat(monto)
    if (!fecha || isNaN(montoNum) || montoNum === 0) { toast.error('Ingresá una fecha y un monto válido'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/gastos/${gasto.id}/pagos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, monto: montoNum }),
      })
      if (!res.ok) {
        const msg = await res.json().then(d => d?.error).catch(() => null)
        throw new Error(msg || 'Error al registrar el pago')
      }
      toast.success('Pago registrado')
      setMonto('')
      setFecha(localToday())
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al registrar el pago')
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ fontWeight: 700 }}>Pagos — {gasto.descripcion}</DialogTitle>

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
              <Box key={p.id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                {editing?.id === p.id ? (
                  <Box sx={{ py: 1.5, display: 'flex', gap: 1, alignItems: { xs: 'stretch', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <AppDateField
                      size="small" label="Fecha" autoFocus
                      value={editing.fecha}
                      onChange={e => setEditing(s => s ? { ...s, fecha: e.target.value } : s)}
                      sx={{ width: { xs: '100%', sm: 155 } }}
                    />
                    <TextField
                      size="small" label="Monto (ARS)" type="number"
                      value={editing.monto}
                      onChange={e => setEditing(s => s ? { ...s, monto: e.target.value } : s)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                      inputProps={{ step: 0.01 }}
                      sx={{ flex: 1 }}
                    />
                    <IconButton size="small" color="primary" onClick={handleSaveEdit} disabled={savingEdit}>
                      {savingEdit ? <CircularProgress size={14} /> : <CheckIcon fontSize="small" />}
                    </IconButton>
                    <IconButton size="small" onClick={() => setEditing(null)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.75 }}>
                    <Box sx={{ display: 'flex', gap: 3 }}>
                      <Typography variant="body2" color="text.secondary">{p.fecha}</Typography>
                      <Typography variant="body2" fontWeight={600}>{fmtARS(p.monto)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex' }}>
                      <IconButton size="small" onClick={() => startEdit(p)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}>
                        {deletingId === p.id ? <CircularProgress size={14} /> : <DeleteIcon fontSize="small" />}
                      </IconButton>
                    </Box>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />

        {/* Formulario nuevo pago */}
        <Typography variant="subtitle2" fontWeight={700} mb={1}>Registrar pago</Typography>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: { xs: 'stretch', sm: 'flex-start' }, flexDirection: { xs: 'column', sm: 'row' } }}>
          <AppDateField
            size="small" label="Fecha"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            sx={{ width: { xs: '100%', sm: 160 } }}
          />
          <TextField
            size="small" label="Monto (ARS)" type="number"
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
            sx={{ height: 40, width: { xs: '100%', sm: 'auto' } }}
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
