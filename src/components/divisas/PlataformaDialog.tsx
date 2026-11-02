'use client'

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import toast from 'react-hot-toast'
import AppTextField from '@/components/shared/AppTextField'
import type { PlataformaDivisa } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  monedaId: number
  codigo: string
  editando: PlataformaDivisa | null
}

/** Alta/edición de una plataforma: cotización a la que vende + comisión que cobra. */
export default function PlataformaDialog({ open, onClose, onSaved, monedaId, codigo, editando }: Props) {
  const [nombre, setNombre] = useState('')
  const [cotizacion, setCotizacion] = useState('')
  const [comisionTipo, setComisionTipo] = useState<'PORCENTAJE' | 'FIJA'>('PORCENTAJE')
  const [comision, setComision] = useState('')
  const [comisionMoneda, setComisionMoneda] = useState<'ARS' | 'DIVISA'>('ARS')
  const [nota, setNota] = useState('')
  const [activa, setActiva] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setNombre(editando?.nombre ?? '')
    setCotizacion(editando ? String(editando.cotizacion) : '')
    setComisionTipo(editando?.comision_tipo ?? 'PORCENTAJE')
    setComision(editando && editando.comision ? String(editando.comision) : '')
    setComisionMoneda(editando?.comision_moneda ?? 'ARS')
    setNota(editando?.nota ?? '')
    setActiva(editando?.activa ?? true)
  }, [open, editando])

  const guardar = async () => {
    if (!nombre.trim()) return toast.error('Ingresá el nombre de la plataforma')
    const c = Number(cotizacion)
    if (!Number.isFinite(c) || c <= 0) return toast.error('Ingresá una cotización mayor a 0')
    const com = comision === '' ? 0 : Number(comision)
    if (!Number.isFinite(com) || com < 0) return toast.error('La comisión no puede ser negativa')
    if (comisionTipo === 'PORCENTAJE' && com >= 100) return toast.error('El porcentaje debe ser menor a 100')

    setSaving(true)
    try {
      const res = await fetch(editando ? `/api/divisas/plataformas/${editando.id}` : '/api/divisas/plataformas', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          moneda_id: monedaId,
          cotizacion: c,
          comision_tipo: comisionTipo,
          comision: com,
          comision_moneda: comisionMoneda,
          nota,
          activa,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Plataforma guardada')
      onSaved()
      onClose()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700}>{editando ? 'Editar plataforma' : 'Nueva plataforma'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          <AppTextField label="Plataforma" value={nombre} onChange={(e) => setNombre(e.target.value)} size="small" fullWidth autoFocus />
          <AppTextField
            label={`Cotización de venta (ARS por ${codigo})`}
            type="number"
            value={cotizacion}
            onChange={(e) => setCotizacion(e.target.value)}
            inputProps={{ step: 'any', min: 0 }}
            size="small"
            fullWidth
          />
          <ToggleButtonGroup
            exclusive
            size="small"
            fullWidth
            value={comisionTipo}
            onChange={(_, v) => v && setComisionTipo(v)}
          >
            <ToggleButton value="PORCENTAJE">Comisión en %</ToggleButton>
            <ToggleButton value="FIJA">Comisión fija</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <AppTextField
              label={comisionTipo === 'PORCENTAJE' ? 'Comisión (%)' : 'Comisión (monto)'}
              type="number"
              value={comision}
              onChange={(e) => setComision(e.target.value)}
              inputProps={{ step: 'any', min: 0 }}
              size="small"
              fullWidth
            />
            <ToggleButtonGroup
              exclusive
              size="small"
              fullWidth
              value={comisionMoneda}
              onChange={(_, v) => v && setComisionMoneda(v)}
              aria-label="Moneda de la comisión"
            >
              <ToggleButton value="ARS">En ARS</ToggleButton>
              <ToggleButton value="DIVISA">En {codigo}</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <AppTextField
            label="Nota"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Límite, plazo de acreditación, requisitos…"
            size="small"
            fullWidth
          />
          <FormControlLabel
            control={<Switch checked={activa} onChange={(e) => setActiva(e.target.checked)} />}
            label="Incluir en la comparación"
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={guardar} disabled={saving}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
