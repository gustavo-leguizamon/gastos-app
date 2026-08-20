'use client'

import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Alert from '@mui/material/Alert'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import toast from 'react-hot-toast'
import AppSelect from '@/components/shared/AppSelect'
import { shiftFechaAPeriodo } from '@/lib/mover-periodo'
import type { Gasto } from '@/lib/types'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

interface Props {
  gasto: Gasto | null
  onClose: () => void
  onMoved: () => void
}

/**
 * Mueve un gasto a otro mes/año. Antes esto no se podía: `mes`/`anio` salían del filtro
 * activo al cargarlo y no eran editables, así que un gasto imputado al mes equivocado
 * había que borrarlo y volver a cargarlo — perdiendo pagos y sub-items.
 */
export default function MoverGastoDialog({ gasto, onClose, onMoved }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [mes, setMes] = useState(1)
  const [anio, setAnio] = useState(2026)
  const [moverFecha, setMoverFecha] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (gasto) {
      setMes(gasto.mes)
      setAnio(gasto.anio)
      setMoverFecha(true)
    }
  }, [gasto])

  if (!gasto) return null

  const sinCambios = mes === gasto.mes && anio === gasto.anio
  const fechaNueva = moverFecha ? shiftFechaAPeriodo(gasto.fecha_vencimiento, mes, anio) : null
  const anios = Array.from({ length: 11 }, (_, i) => gasto.anio - 5 + i)

  const handleMover = async () => {
    setGuardando(true)
    try {
      const res = await fetch(`/api/gastos/${gasto.id}/periodo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, anio, mover_fecha: moverFecha }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error ?? 'Error al mover el gasto'); return }
      toast.success(`Movido a ${MESES[mes - 1]} ${anio}`)
      onMoved()
      onClose()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ fontWeight: 700 }}>Mover a otro mes</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          <strong>{gasto.descripcion}</strong> está imputado a{' '}
          {MESES[gasto.mes - 1]} {gasto.anio}. Sus pagos y sub-ítems se mueven con él.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
          <AppSelect
            label="Mes"
            options={MESES.map((m, i) => ({ value: i + 1, label: m }))}
            value={mes}
            onChange={(v) => setMes(Number(v))}
            fullWidth
            disableClearable
          />
          <AppSelect
            label="Año"
            options={anios.map(a => ({ value: a, label: String(a) }))}
            value={anio}
            onChange={(v) => setAnio(Number(v))}
            fullWidth
            disableClearable
          />
        </Box>

        <FormControlLabel
          control={<Checkbox checked={moverFecha} onChange={e => setMoverFecha(e.target.checked)} />}
          label="Mover también la fecha de vencimiento"
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4 }}>
          {moverFecha
            ? `${gasto.fecha_vencimiento} → ${fechaNueva ?? gasto.fecha_vencimiento}`
            : `Queda en ${gasto.fecha_vencimiento}`}
        </Typography>

        {gasto.es_tarjeta && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Es un resumen de tarjeta. Las fechas de cierre viven aparte, por mes, y no se mueven
            con él: revisá el cierre del período destino.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleMover} disabled={sinCambios || guardando}>
          {sinCambios ? 'Elegí otro mes' : 'Mover'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
