'use client'

import { useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import toast from 'react-hot-toast'
import AppDateField from '@/components/shared/AppDateField'
import AppSelect from '@/components/shared/AppSelect'
import AppTextField from '@/components/shared/AppTextField'
import { computeOperaciones, type TipoOperacionDivisa } from '@/lib/divisas-compute'
import type { OperacionDivisa } from '@/lib/types'
import { colorResultado, fmtArs, fmtConSigno, fmtDivisa } from './formato'

/** Qué pide cada tipo y cómo se lee. El copy va acá para que el form no tenga condicionales sueltos. */
const TIPOS: {
  value: TipoOperacionDivisa
  label: string
  ayuda: string
  cotizacionRequerida: boolean
}[] = [
  { value: 'compra', label: 'Compra', ayuda: 'Pesos → divisa. Suma tenencia y suma costo.', cotizacionRequerida: true },
  { value: 'venta', label: 'Venta', ayuda: 'Divisa → pesos. Realiza el resultado contra el costo promedio.', cotizacionRequerida: true },
  {
    value: 'rendimiento',
    label: 'Rendimiento',
    ayuda: 'Divisa generada (interés, ganancia de una inversión, un cobro en USD). Entra con costo 0 y baja el promedio.',
    cotizacionRequerida: false,
  },
  {
    value: 'egreso',
    label: 'Egreso',
    ayuda: 'Divisa que salió sin venderse. La cotización es opcional: sólo sirve para saber cuánto valía.',
    cotizacionRequerida: false,
  },
]

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  monedaId: number
  simbolo: string
  /**
   * Todas las operaciones de la divisa. Se usan para el **preview en vivo**: el resultado de
   * una venta depende del costo promedio acumulado hasta esa fecha, así que el borrador se
   * intercala en la corrida real. Es la misma función que después calcula la grilla.
   */
  operaciones: OperacionDivisa[]
  /** Operación en edición, o `null` para un alta. */
  editando: OperacionDivisa | null
  /** Última cotización cargada: prefill del campo en un alta. */
  cotizacionSugerida: number | null
  /** Plataformas ya usadas, para sugerir sin obligar (el campo es texto libre). */
  plataformas: string[]
}

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function OperacionDivisaDialog({
  open,
  onClose,
  onSaved,
  monedaId,
  simbolo,
  operaciones,
  editando,
  cotizacionSugerida,
  plataformas,
}: Props) {
  const [fecha, setFecha] = useState(todayLocal())
  const [tipo, setTipo] = useState<TipoOperacionDivisa>('compra')
  const [cantidad, setCantidad] = useState('')
  const [cotizacion, setCotizacion] = useState('')
  const [comision, setComision] = useState('')
  const [comisionMoneda, setComisionMoneda] = useState<'ARS' | 'DIVISA'>('ARS')
  const [plataforma, setPlataforma] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editando) {
      setFecha(editando.fecha)
      setTipo(editando.tipo)
      setCantidad(String(editando.cantidad))
      setCotizacion(editando.cotizacion === null ? '' : String(editando.cotizacion))
      setComision(editando.comision === 0 ? '' : String(editando.comision))
      setComisionMoneda(editando.comision_moneda)
      setPlataforma(editando.plataforma ?? '')
      setDescripcion(editando.descripcion ?? '')
    } else {
      setFecha(todayLocal())
      setTipo('compra')
      setCantidad('')
      setCotizacion(cotizacionSugerida === null ? '' : String(cotizacionSugerida))
      setComision('')
      setComisionMoneda('ARS')
      setPlataforma('')
      setDescripcion('')
    }
  }, [open, editando, cotizacionSugerida])

  const meta = TIPOS.find((t) => t.value === tipo)!

  /**
   * El borrador intercalado en la corrida real, en su posición cronológica. Al editar se
   * saca la operación original de la lista: si no, el preview mediría el costo promedio
   * contra una versión de sí misma.
   */
  const preview = useMemo(() => {
    const cant = Number(cantidad)
    if (!Number.isFinite(cant) || cant <= 0) return null
    const cotNum = cotizacion === '' ? null : Number(cotizacion)
    if (meta.cotizacionRequerida && (cotNum === null || !Number.isFinite(cotNum) || cotNum <= 0)) return null

    const borrador: OperacionDivisa = {
      id: -1,
      fecha,
      tipo,
      moneda_id: monedaId,
      moneda_codigo: null,
      moneda_simbolo: simbolo,
      cantidad: cant,
      cotizacion: cotNum !== null && Number.isFinite(cotNum) && cotNum > 0 ? cotNum : null,
      comision: comision === '' ? 0 : Number(comision) || 0,
      comision_moneda: comisionMoneda,
      plataforma: null,
      descripcion: null,
      created_at: '',
      updated_at: '',
    }

    const resto = operaciones.filter((o) => !editando || o.id !== editando.id)
    const orden = [...resto, borrador].sort((a, b) =>
      a.fecha !== b.fecha ? a.fecha.localeCompare(b.fecha) : a.id === -1 ? 1 : b.id === -1 ? -1 : a.id - b.id,
    )
    return computeOperaciones(orden).find((o) => o.id === -1) ?? null
  }, [cantidad, cotizacion, comision, comisionMoneda, fecha, tipo, monedaId, simbolo, operaciones, editando, meta])

  const submit = async () => {
    const cant = Number(cantidad)
    if (!Number.isFinite(cant) || cant <= 0) {
      toast.error('La cantidad tiene que ser mayor a 0')
      return
    }
    const cotNum = cotizacion === '' ? null : Number(cotizacion)
    if (meta.cotizacionRequerida && (cotNum === null || !Number.isFinite(cotNum) || cotNum <= 0)) {
      toast.error(`La cotización es obligatoria en una ${meta.label.toLowerCase()}`)
      return
    }

    const body = {
      fecha,
      tipo,
      moneda_id: monedaId,
      cantidad: cant,
      cotizacion: cotNum,
      comision: comision === '' ? 0 : Number(comision),
      comision_moneda: comisionMoneda,
      plataforma,
      descripcion,
    }

    setSaving(true)
    try {
      const url = editando ? `/api/divisas/operaciones/${editando.id}` : '/api/divisas/operaciones'
      const res = await fetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success(editando ? 'Operación actualizada' : 'Operación registrada')
      onSaved()
      onClose()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700}>{editando ? 'Editar operación' : 'Nueva operación'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 1 }}>
          <AppDateField label="Fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} fullWidth />
          <AppSelect
            label="Tipo"
            options={TIPOS.map((t) => ({ value: t.value, label: t.label }))}
            value={tipo}
            onChange={(v) => setTipo((v as TipoOperacionDivisa) ?? 'compra')}
            disableClearable
            fullWidth
          />
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, mb: 1 }}>
          {meta.ayuda}
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 1 }}>
          <AppTextField
            label={`Cantidad (${simbolo})`}
            type="number"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            inputProps={{ step: 'any', min: 0 }}
            helperText="Siempre positiva: la dirección la da el tipo"
            fullWidth
          />
          <AppTextField
            label="Cotización (ARS por unidad)"
            type="number"
            value={cotizacion}
            onChange={(e) => setCotizacion(e.target.value)}
            inputProps={{ step: 'any', min: 0 }}
            helperText={meta.cotizacionRequerida ? 'Obligatoria' : 'Opcional'}
            fullWidth
          />
          <AppTextField
            label="Comisión"
            type="number"
            value={comision}
            onChange={(e) => setComision(e.target.value)}
            inputProps={{ step: 'any', min: 0 }}
            fullWidth
          />
          <AppSelect
            label="Comisión cobrada en"
            options={[
              { value: 'ARS', label: 'Pesos' },
              { value: 'DIVISA', label: `Divisa (${simbolo})` },
            ]}
            value={comisionMoneda}
            onChange={(v) => setComisionMoneda(v === 'DIVISA' ? 'DIVISA' : 'ARS')}
            disableClearable
            fullWidth
          />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 2 }}>
          <Autocomplete
            freeSolo
            options={plataformas}
            value={plataforma}
            onInputChange={(_, v) => setPlataforma(v ?? '')}
            renderInput={(params) => (
              <AppTextField {...params} label="Plataforma" placeholder="Banco, broker, billetera" />
            )}
          />
          <AppTextField
            label="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Opcional"
            fullWidth
          />
        </Box>

        {preview && (
          <Alert severity="info" icon={false} sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
              {preview.divisa_neta >= 0 ? 'Entran' : 'Salen'} {fmtDivisa(Math.abs(preview.divisa_neta), simbolo)}
              {preview.ars_neto !== 0 && (
                <> · {preview.ars_neto < 0 ? 'salen' : 'entran'} {fmtArs(Math.abs(preview.ars_neto))}</>
              )}
            </Typography>
            {preview.cotizacion_efectiva !== null && (
              <Typography variant="caption" sx={{ display: 'block' }}>
                Cotización efectiva (con comisión): <strong>{fmtArs(preview.cotizacion_efectiva)}</strong> por unidad
              </Typography>
            )}
            {preview.resultado !== null && (
              <Typography variant="caption" sx={{ display: 'block', color: colorResultado(preview.resultado) }}>
                Resultado realizado: <strong>{fmtConSigno(preview.resultado, fmtArs)}</strong>
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Tenencia después: {fmtDivisa(preview.tenencia, simbolo)}
              {preview.costo_promedio !== null && <> · costo promedio {fmtArs(preview.costo_promedio)}</>}
            </Typography>
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
