'use client'

import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import toast from 'react-hot-toast'
import type { PromocionConProgreso } from '@/lib/types'

interface Candidato {
  id: number
  descripcion: string
  fecha_vencimiento: string
  tipo_pago: 'C' | 'D'
  tarjeta_nombre: string | null
  total_ars: number
  asociado: boolean
  asociado_a_otra: boolean
}

interface Props {
  promo: PromocionConProgreso | null
  mes: number
  anio: number
  onClose: () => void
  onSaved: () => void
}

const fmtARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

/**
 * Los gastos del mes que podrían contar para la promo, con un check cada uno. Sirve para
 * asociar de una vez lo que se cargó antes de que existiera la promo (o antes de que el form
 * la sugiriera), y para soltar lo que no corresponde — por ejemplo una compra anterior al
 * inicio de la promo.
 */
export default function AsociarGastosDialog({ promo, mes, anio, onClose, onSaved }: Props) {
  const [items, setItems] = useState<Candidato[] | null>(null)
  const [marcados, setMarcados] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!promo) return
    setItems(null)
    setError(null)
    fetch(`/api/promociones/${promo.id}/candidatos?mes=${mes}&anio=${anio}`, { cache: 'no-store' })
      .then(async r => {
        const d = await r.json().catch(() => null)
        if (!r.ok) throw new Error(d?.error ?? 'Error al cargar los gastos')
        return d as Candidato[]
      })
      .then(d => {
        setItems(d)
        setMarcados(new Set(d.filter(c => c.asociado).map(c => c.id)))
      })
      .catch(e => setError(e.message))
  }, [promo, mes, anio])

  if (!promo) return null

  const toggle = (id: number) =>
    setMarcados(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const submit = async () => {
    if (!items) return
    const aAsociar = items.filter(c => marcados.has(c.id) && !c.asociado).map(c => c.id)
    const aSoltar = items.filter(c => !marcados.has(c.id) && c.asociado).map(c => c.id)
    if (aAsociar.length === 0 && aSoltar.length === 0) return onClose()

    setSaving(true)
    try {
      const llamar = (gasto_ids: number[], asociar: boolean) =>
        gasto_ids.length === 0
          ? Promise.resolve(true)
          : fetch(`/api/promociones/${promo.id}/asociar`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ gasto_ids, asociar }),
            }).then(r => r.ok)
      const oks = await Promise.all([llamar(aAsociar, true), llamar(aSoltar, false)])
      if (oks.includes(false)) return toast.error('No se pudieron guardar todos los cambios')
      toast.success('Gastos actualizados')
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const total = items?.filter(c => marcados.has(c.id)).reduce((s, c) => s + c.total_ars, 0) ?? 0

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700}>Gastos que cuentan · {promo.lugar}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Marcá los gastos del mes que tuvieron la promo. Los que no marques (por ejemplo, compras anteriores a que
          empezara) no suman al reintegro.
        </Typography>

        {error && <Alert severity="warning">{error}</Alert>}
        {!items && !error && <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} /></Box>}
        {items && items.length === 0 && (
          <Alert severity="info">No hay gastos de estos conceptos con estos medios de pago en el mes.</Alert>
        )}

        {items && items.map(c => (
          <Box
            key={c.id}
            onClick={() => toggle(c.id)}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
          >
            <Checkbox checked={marcados.has(c.id)} tabIndex={-1} disableRipple />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {c.fecha_vencimiento.split('-').reverse().join('/')} · {c.descripcion}
                {c.tarjeta_nombre ? ` · ${c.tarjeta_nombre}` : c.tipo_pago === 'D' ? ' · Débito / Efectivo' : ''}
              </Typography>
              {c.asociado_a_otra && (
                <Typography variant="caption" color="warning.main">Hoy cuenta para otra promo: marcarlo se la saca</Typography>
              )}
            </Box>
            <Typography variant="body2" fontWeight={700}>{fmtARS(c.total_ars)}</Typography>
          </Box>
        ))}

        {items && items.length > 0 && (
          <Typography variant="body2" sx={{ mt: 1.5 }}>
            Gasto que cuenta: <b>{fmtARS(total)}</b> · reintegro estimado <b>{fmtARS((total * promo.porcentaje) / 100)}</b>
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={submit} variant="contained" disabled={saving || !items}>Guardar</Button>
      </DialogActions>
    </Dialog>
  )
}
