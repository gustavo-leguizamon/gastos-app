'use client'

import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import toast from 'react-hot-toast'
import BrandLogo from '@/components/shared/BrandLogo'
import AppDateField from '@/components/shared/AppDateField'
import AppMultiSelect from '@/components/shared/AppMultiSelect'
import AppTextField from '@/components/shared/AppTextField'
import PaymentsIcon from '@mui/icons-material/Payments'
import AppToggle from '@/components/shared/AppToggle'
import { DIAS_CORTOS, DIAS_SEMANA } from '@/lib/promociones-compute'
import { tarjetasVisiblesEn } from '@/lib/tarjetas-baja'
import type { Promocion, Tarjeta } from '@/lib/types'

interface Concepto { id: number; nombre: string }

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** Promo en edición, o `null` para un alta. */
  editando: Promocion | null
  tarjetas: Tarjeta[]
  /** Período que se está mirando: decide qué tarjetas (no dadas de baja) se ofrecen. */
  mes: number
  anio: number
}

/** Valor centinela de "Débito / Efectivo" dentro de la lista de medios (el resto son ids de tarjeta). */
const EFECTIVO = 'efectivo'
const EFECTIVO_OPCION = {
  value: EFECTIVO,
  label: 'Débito / Efectivo',
  render: () => (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      <PaymentsIcon sx={{ fontSize: 22, color: 'success.main' }} />
      <span>Débito / Efectivo</span>
    </Box>
  ),
}

const fmtARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

export default function PromocionDialog({ open, onClose, onSaved, editando, tarjetas, mes, anio }: Props) {
  const [conceptos, setConceptos] = useState<Concepto[]>([])
  const [lugar, setLugar] = useState('')
  const [conceptoIds, setConceptoIds] = useState<number[]>([])
  const [porcentaje, setPorcentaje] = useState('')
  const [tope, setTope] = useState('')
  const [dias, setDias] = useState<number[]>([])
  const [tarjetaIds, setTarjetaIds] = useState<number[]>([])
  const [efectivo, setEfectivo] = useState(false)
  const [activa, setActiva] = useState(true)
  const [notas, setNotas] = useState('')
  const [vigenteDesde, setVigenteDesde] = useState('')
  const [vigenteHasta, setVigenteHasta] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch('/api/conceptos').then(r => r.json()).then(setConceptos).catch(() => {})
    setLugar(editando?.lugar ?? '')
    setConceptoIds(editando?.concepto_ids ?? [])
    setPorcentaje(editando ? String(editando.porcentaje) : '')
    setTope(editando ? String(editando.tope_mensual) : '')
    setDias(editando?.dias ?? [])
    setTarjetaIds(editando?.tarjeta_ids ?? [])
    setEfectivo(editando?.efectivo ?? false)
    setActiva(editando?.activa ?? true)
    setNotas(editando?.notas ?? '')
    setVigenteDesde(editando?.vigente_desde ?? '')
    setVigenteHasta(editando?.vigente_hasta ?? '')
  }, [open, editando])

  // Las dadas de baja no se ofrecen para promos nuevas, pero una ya elegida se conserva.
  const opcionesMedios = useMemo(
    () => [EFECTIVO_OPCION, ...tarjetasVisiblesEn(tarjetas, mes, anio, tarjetaIds).map(t => {
      // Mismo formato que el select de tarjeta en la carga de gastos: logo de la marca + "Nombre (Banco)".
      const label = `${t.nombre}${t.banco ? ` (${t.banco})` : ''}`
      return {
        value: t.id,
        label,
        render: () => (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <BrandLogo marca={t.marca} width={30} height={22} />
            <span>{label}</span>
          </Box>
        ),
      }
    })],
    [tarjetas, mes, anio, tarjetaIds],
  )

  const pct = Number(porcentaje.replace(',', '.'))
  const topeNum = Number(tope.replace(',', '.'))
  // El dato que hace útil la promo: cuánto hay que gastar para exprimir el tope.
  const gastoMinimo = pct > 0 && topeNum > 0 ? topeNum / (pct / 100) : null

  const submit = async () => {
    if (!lugar.trim()) return toast.error('Poné el lugar de la promo')
    if (!(pct > 0 && pct <= 100)) return toast.error('El porcentaje debe estar entre 0 y 100')
    if (!(topeNum > 0)) return toast.error('El tope mensual debe ser mayor a 0')
    if (dias.length === 0) return toast.error('Elegí al menos un día')
    if (tarjetaIds.length === 0 && !efectivo) return toast.error('Elegí al menos un medio de pago')
    if (vigenteDesde && vigenteHasta && vigenteHasta < vigenteDesde) return toast.error('La vigencia termina antes de empezar')

    setSaving(true)
    try {
      const res = await fetch(editando ? `/api/promociones/${editando.id}` : '/api/promociones', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lugar,
          concepto_ids: conceptoIds,
          porcentaje: pct,
          tope_mensual: topeNum,
          dias,
          tarjeta_ids: tarjetaIds,
          efectivo,
          activa,
          notas,
          vigente_desde: vigenteDesde || null,
          vigente_hasta: vigenteHasta || null,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) return toast.error(d.error ?? 'Error al guardar')
      toast.success(editando ? 'Promoción actualizada' : 'Promoción creada')
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700}>{editando ? 'Editar promoción' : 'Nueva promoción'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <AppTextField label="Lugar" size="small" fullWidth value={lugar} onChange={e => setLugar(e.target.value)} autoFocus />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <AppTextField
              label="Reintegro %" size="small" fullWidth value={porcentaje}
              onChange={e => setPorcentaje(e.target.value)} inputProps={{ inputMode: 'decimal' }}
            />
            <AppTextField
              label="Tope por mes ($)" size="small" fullWidth value={tope}
              onChange={e => setTope(e.target.value)} inputProps={{ inputMode: 'decimal' }}
            />
          </Box>

          {gastoMinimo != null && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: -1 }}>
              Para aprovechar el tope completo tenés que gastar <b>{fmtARS(gastoMinimo)}</b> en el mes.
            </Typography>
          )}

          <Box>
            <Typography variant="caption" color="text.secondary">Días</Typography>
            <ToggleButtonGroup
              value={dias}
              onChange={(_, v: number[]) => setDias(v)}
              size="small"
              fullWidth
              sx={{ display: 'flex', mt: 0.5 }}
            >
              {DIAS_CORTOS.map((d, i) => (
                <ToggleButton key={i} value={i} aria-label={DIAS_SEMANA[i]} sx={{ flex: 1, px: 0.5 }}>{d}</ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              <Button size="small" onClick={() => setDias([0, 1, 2, 3, 4])}>Lun–Vie</Button>
              <Button size="small" onClick={() => setDias([5, 6])}>Fin de semana</Button>
              <Button size="small" onClick={() => setDias([0, 1, 2, 3, 4, 5, 6])}>Todos</Button>
            </Box>
          </Box>

          <AppMultiSelect
            label="Medios de pago"
            size="small"
            fullWidth
            options={opcionesMedios}
            value={efectivo ? [EFECTIVO, ...tarjetaIds] : tarjetaIds}
            onChange={v => {
              setEfectivo(v.includes(EFECTIVO))
              setTarjetaIds(v.filter(x => x !== EFECTIVO).map(Number))
            }}
          />

          <AppMultiSelect
            label="Conceptos vinculados (opcional)"
            size="small"
            fullWidth
            options={conceptos.map(c => ({ value: c.id, label: c.nombre }))}
            value={conceptoIds}
            onChange={v => {
              const ids = v.map(Number)
              setConceptoIds(ids)
              if (ids.length && !lugar.trim()) setLugar(conceptos.find(c => c.id === ids[0])?.nombre ?? '')
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
            Al cargar un gasto de cualquiera de esos conceptos con uno de estos medios de pago, la promo se te
            sugiere y queda asociada. Sin vincular no se sugiere: sólo suman los gastos que asocies a mano y los
            usos manuales.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <AppDateField label="Vigente desde (opcional)" size="small" fullWidth value={vigenteDesde} onChange={e => setVigenteDesde(e.target.value)} />
            <AppDateField label="Vigente hasta (opcional)" size="small" fullWidth value={vigenteHasta} onChange={e => setVigenteHasta(e.target.value)} />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
            Fuera de ese rango no se sugiere ni cuenta en el mes. Sirve cuando la promo arranca o termina a mitad de mes.
          </Typography>

          <AppTextField label="Notas" size="small" fullWidth multiline minRows={2} value={notas} onChange={e => setNotas(e.target.value)} />
          <AppToggle label="Promoción activa" checked={activa} onChange={e => setActiva(e.target.checked)} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={submit} variant="contained" disabled={saving}>Guardar</Button>
      </DialogActions>
    </Dialog>
  )
}
