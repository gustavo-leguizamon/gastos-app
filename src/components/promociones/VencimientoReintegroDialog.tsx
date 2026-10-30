'use client'

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import toast from 'react-hot-toast'
import AppDateField from '@/components/shared/AppDateField'
import AppToggle from '@/components/shared/AppToggle'
import type { ReintegroPromo } from '@/lib/types'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

interface Props {
  /** Promo y mes del reintegro a editar, o `null` con el diálogo cerrado. */
  objetivo: { promocionId: number; lugar: string; mes: number; anio: number; actual: ReintegroPromo | null } | null
  onClose: () => void
  onSaved: () => void
}

/**
 * Carga el vencimiento del reintegro de una promo **en un mes**: la fecha cambia de un mes a otro,
 * así que se guarda por período. Con "Ya lo usé" el reintegro deja de aparecer en los avisos.
 */
export default function VencimientoReintegroDialog({ objetivo, onClose, onSaved }: Props) {
  const [venceEl, setVenceEl] = useState('')
  const [utilizado, setUtilizado] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!objetivo) return
    setVenceEl(objetivo.actual?.vence_el ?? '')
    setUtilizado(objetivo.actual?.utilizado ?? false)
  }, [objetivo])

  const guardar = async (fecha: string, usado: boolean) => {
    if (!objetivo) return
    setSaving(true)
    try {
      const res = await fetch(`/api/promociones/${objetivo.promocionId}/reintegro`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes: objetivo.mes, anio: objetivo.anio, vence_el: fecha || null, utilizado: usado }),
      })
      if (!res.ok) return toast.error('Error al guardar el vencimiento')
      toast.success(fecha || usado ? 'Vencimiento guardado' : 'Vencimiento quitado')
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!objetivo} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700}>Vencimiento del reintegro</DialogTitle>
      <DialogContent>
        {objetivo && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Reintegro de <b>{objetivo.lugar}</b> de {MESES[objetivo.mes - 1]} {objetivo.anio}. Cargá hasta cuándo
              lo podés usar y te avisamos antes de que venza.
            </Typography>
            <AppDateField
              label="Vence el" size="small" fullWidth value={venceEl}
              onChange={e => setVenceEl(e.target.value)}
            />
            <AppToggle label="Ya lo usé" checked={utilizado} onChange={e => setUtilizado(e.target.checked)} />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {objetivo?.actual && (
          <Button color="inherit" onClick={() => guardar('', false)} disabled={saving} sx={{ mr: 'auto' }}>
            Quitar vencimiento
          </Button>
        )}
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={() => guardar(venceEl, utilizado)} variant="contained" disabled={saving || (!venceEl && !utilizado)}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
