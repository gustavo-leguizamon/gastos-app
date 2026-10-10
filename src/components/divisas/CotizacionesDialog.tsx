'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import toast from 'react-hot-toast'
import AppDateField from '@/components/shared/AppDateField'
import AppTextField from '@/components/shared/AppTextField'
import type { CotizacionDivisa } from '@/lib/types'
import { fmtArs } from './formato'

interface Props {
  open: boolean
  onClose: () => void
  onChanged: () => void
  monedaId: number
  codigo: string
  /** Histórico cargado, cronológico ascendente. */
  cotizaciones: CotizacionDivisa[]
}

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * ABM del histórico de cotizaciones. Se guarda la serie completa y no sólo el último valor
 * porque sin ella el gráfico no tiene con qué valuar la tenencia en cada momento: sólo se
 * podría dibujar el punto de hoy.
 */
export default function CotizacionesDialog({ open, onClose, onChanged, monedaId, codigo, cotizaciones }: Props) {
  const [fecha, setFecha] = useState(todayLocal())
  const [valor, setValor] = useState('')
  const [fuente, setFuente] = useState('')
  const [saving, setSaving] = useState(false)

  const agregar = async () => {
    const n = Number(valor)
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Ingresá una cotización mayor a 0')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/divisas/cotizaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moneda_id: monedaId, fecha, valor: n, fuente }),
      })
      if (!res.ok) throw new Error()
      toast.success('Cotización guardada')
      setValor('')
      onChanged()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const borrar = async (id: number) => {
    try {
      const res = await fetch(`/api/divisas/cotizaciones/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      onChanged()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  // Las más recientes primero: es lo que se va a mirar y corregir.
  const ordenadas = [...cotizaciones].sort((a, b) => b.fecha.localeCompare(a.fecha))

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700}>Cotizaciones de {codigo}</DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Una por día: es la referencia con la que se valúa la tenencia. Volver a cargar el mismo
          día corrige el valor.
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          <AppDateField label="Fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} size="small" fullWidth />
          <AppTextField
            label="ARS por unidad"
            type="number"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputProps={{ step: 'any', min: 0 }}
            size="small"
            fullWidth
            onKeyDown={(e) => {
              if (e.key === 'Enter') agregar()
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5 }}>
          <AppTextField
            label="Fuente"
            value={fuente}
            onChange={(e) => setFuente(e.target.value)}
            placeholder="BNA, MEP, blue…"
            size="small"
            fullWidth
          />
          <Button variant="contained" startIcon={<AddIcon />} onClick={agregar} disabled={saving} sx={{ flexShrink: 0 }}>
            Agregar
          </Button>
        </Box>

        {ordenadas.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            Todavía no hay ninguna cargada. Sin cotización la tenencia no se puede valuar en pesos.
          </Typography>
        ) : (
          <List dense sx={{ mt: 2, maxHeight: 280, overflowY: 'auto' }}>
            {ordenadas.map((c) => (
              <ListItem
                key={c.id}
                divider
                secondaryAction={
                  <IconButton edge="end" size="small" onClick={() => borrar(c.id)} aria-label="eliminar">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={`${c.fecha} — ${fmtArs(c.valor)}`}
                  secondary={c.fuente ?? undefined}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}
