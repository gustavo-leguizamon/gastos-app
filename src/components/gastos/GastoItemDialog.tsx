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
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight'
import toast from 'react-hot-toast'
import type { Gasto } from '@/lib/types'

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

interface Props {
  open: boolean
  gasto: Gasto | null
  onClose: () => void
  onChanged: () => void
}

export default function GastoItemDialog({ open, gasto, onClose, onChanged }: Props) {
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  if (!gasto) return null

  const items = gasto.items ?? []
  const totalItems = items.reduce((s, i) => s + i.monto, 0)

  const handleAdd = async () => {
    if (!descripcion.trim() || !monto) {
      toast.error('Descripción y monto son requeridos')
      return
    }
    const montoNum = parseFloat(monto)
    if (isNaN(montoNum) || montoNum <= 0) {
      toast.error('Ingresá un monto válido')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/gastos/${gasto.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descripcion: descripcion.trim(), monto: montoNum, fecha: fecha || null }),
      })
      if (!res.ok) throw new Error()
      toast.success('Item agregado')
      setDescripcion('')
      setMonto('')
      setFecha('')
      onChanged()
    } catch {
      toast.error('Error al agregar item')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (itemId: number) => {
    setDeletingId(itemId)
    try {
      const res = await fetch(`/api/gastos/${gasto.id}/items/${itemId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Item eliminado')
      onChanged()
    } catch {
      toast.error('Error al eliminar item')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <SubdirectoryArrowRightIcon color="primary" />
        Sub-items — {gasto.descripcion}
      </DialogTitle>

      <DialogContent dividers>
        {/* Resumen */}
        <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Total gasto</Typography>
            <Typography fontWeight={700}>{fmtARS(gasto.total_ars)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Suma sub-items</Typography>
            <Typography fontWeight={700} color={totalItems > gasto.total_ars ? 'error.main' : 'text.primary'}>
              {fmtARS(totalItems)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Sin asignar</Typography>
            <Typography fontWeight={700} color="text.secondary">
              {fmtARS(gasto.total_ars - totalItems)}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Lista de items */}
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            No hay sub-items cargados aún.
          </Typography>
        ) : (
          <Box sx={{ mb: 2 }}>
            {items.map(item => (
              <Box
                key={item.id}
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
                  <SubdirectoryArrowRightIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap>{item.descripcion}</Typography>
                    {item.fecha && (
                      <Typography variant="caption" color="text.secondary">{item.fecha}</Typography>
                    )}
                  </Box>
                  <Typography variant="body2" fontWeight={600} sx={{ flexShrink: 0 }}>
                    {fmtARS(item.monto)}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  sx={{ ml: 1 }}
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id
                    ? <CircularProgress size={14} />
                    : <DeleteIcon fontSize="small" />}
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />

        {/* Formulario nuevo item */}
        <Typography variant="subtitle2" fontWeight={700} mb={1}>Agregar sub-item</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            size="small"
            label="Descripción"
            fullWidth
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
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
            <TextField
              size="small"
              label="Fecha (opcional)"
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              onClick={e => (e.currentTarget.querySelector('input') as any)?.showPicker?.()}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160 }}
            />
          </Box>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
            onClick={handleAdd}
            disabled={saving}
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
