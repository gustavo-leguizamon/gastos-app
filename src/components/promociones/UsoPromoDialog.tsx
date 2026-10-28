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
import AppTextField from '@/components/shared/AppTextField'
import type { PromocionConProgreso } from '@/lib/types'

interface Props {
  promo: PromocionConProgreso | null
  /** Fecha sugerida (hoy, o el primer día del período si se mira otro mes). */
  fechaInicial: string
  onClose: () => void
  onSaved: () => void
}

/** Registra a mano un consumo con promo: para lo que el cálculo automático no ve. */
export default function UsoPromoDialog({ promo, fechaInicial, onClose, onSaved }: Props) {
  const [fecha, setFecha] = useState(fechaInicial)
  const [monto, setMonto] = useState('')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!promo) return
    setFecha(fechaInicial)
    setMonto('')
    setNotas('')
  }, [promo, fechaInicial])

  if (!promo) return null

  const montoNum = Number(monto.replace(',', '.'))
  const reintegro = montoNum > 0 ? (montoNum * promo.porcentaje) / 100 : 0

  const submit = async () => {
    if (!(montoNum > 0)) return toast.error('Poné cuánto gastaste')
    setSaving(true)
    try {
      const res = await fetch(`/api/promociones/${promo.id}/usos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, monto_gasto: montoNum, notas }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) return toast.error(d.error ?? 'Error al guardar')
      toast.success('Uso registrado')
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700}>Registrar uso · {promo.lugar}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <AppDateField label="Fecha" size="small" fullWidth value={fecha} onChange={e => setFecha(e.target.value)} />
          <AppTextField
            label="Monto gastado ($)" size="small" fullWidth autoFocus value={monto}
            onChange={e => setMonto(e.target.value)} inputProps={{ inputMode: 'decimal' }}
          />
          {reintegro > 0 && (
            <Typography variant="body2" color="text.secondary">
              Reintegro estimado: <b>{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(reintegro)}</b>{' '}
              ({promo.porcentaje}%, sujeto al tope del mes)
            </Typography>
          )}
          <AppTextField label="Nota (opcional)" size="small" fullWidth value={notas} onChange={e => setNotas(e.target.value)} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={submit} variant="contained" disabled={saving}>Guardar</Button>
      </DialogActions>
    </Dialog>
  )
}
