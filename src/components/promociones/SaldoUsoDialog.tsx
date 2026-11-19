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

const fmtARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

interface Props {
  /** Promo cuyo saldo se usó, o `null` con el diálogo cerrado. */
  promo: { id: number; lugar: string; saldo: { disponible: number } } | null
  /** Fecha local de hoy (`YYYY-MM-DD`). */
  hoy: string
  onClose: () => void
  onSaved: () => void
}

/**
 * Registra que se usó parte (o todo) del saldo a favor de una promo: "de lo que me reintegraron,
 * gasté $X". Se descuenta primero de lo que vence antes; el resto sigue como saldo y lo próximo
 * que se reintegre se suma.
 */
export default function SaldoUsoDialog({ promo, hoy, onClose, onSaved }: Props) {
  const [fecha, setFecha] = useState(hoy)
  const [monto, setMonto] = useState('')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!promo) return
    setFecha(hoy)
    setMonto(promo.saldo.disponible > 0 ? String(Math.round(promo.saldo.disponible * 100) / 100) : '')
    setNotas('')
  }, [promo, hoy])

  if (!promo) return null

  const montoNum = Number(monto.replace(',', '.'))
  const queda = promo.saldo.disponible - (montoNum > 0 ? montoNum : 0)

  const submit = async () => {
    if (!(montoNum > 0)) return toast.error('Poné cuánto usaste del saldo')
    setSaving(true)
    try {
      const res = await fetch(`/api/promociones/${promo.id}/saldo-usos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, monto: montoNum, notas }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) return toast.error(d.error ?? 'Error al guardar')
      toast.success('Uso del saldo registrado')
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700}>Usé saldo · {promo.lugar}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Saldo a favor hoy: <b>{fmtARS(promo.saldo.disponible)}</b>
          </Typography>
          <AppDateField label="Fecha" size="small" fullWidth value={fecha} onChange={e => setFecha(e.target.value)} />
          <AppTextField
            label="Monto usado ($)" size="small" fullWidth autoFocus value={monto}
            onChange={e => setMonto(e.target.value)} inputProps={{ inputMode: 'decimal' }}
          />
          {montoNum > 0 && (
            <Typography variant="body2" color={queda < -0.005 ? 'warning.main' : 'text.secondary'}>
              {queda < -0.005
                ? `Es ${fmtARS(-queda)} más que el saldo que tenés registrado.`
                : `Te van a quedar ${fmtARS(queda)} de saldo.`}
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
