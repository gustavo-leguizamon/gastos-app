'use client'

import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import TextField from '@/components/shared/AppTextField'
import AppDateField from '@/components/shared/AppDateField'
import AppSelect from '@/components/shared/AppSelect'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import toast from 'react-hot-toast'
import type { Casa, Ingreso, Moneda } from '@/lib/types'
import type { IngresoInput } from './useIngresos'

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

/**
 * Fecha con la que arranca el alta: hoy si cae dentro del mes que se está mirando, y si no
 * el día 1 de ese mes (cargar un ingreso de junio en agosto no debería proponer una fecha
 * de agosto). La fecha local se arma a mano, nunca con `toISOString()` (devuelve UTC).
 */
export function fechaInicial(mes: number, anio: number) {
  const d = new Date()
  if (d.getFullYear() === anio && d.getMonth() + 1 === mes) {
    return `${anio}-${String(mes).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return `${anio}-${String(mes).padStart(2, '0')}-01`
}

interface Props {
  mes: number
  anio: number
  casas: Casa[]
  monedas: Moneda[]
  /** Ingreso en edición, o `null` para alta. */
  editing: Ingreso | null
  onSubmit: (input: IngresoInput, id?: number) => Promise<boolean>
  onCancelEdit: () => void
  saving?: boolean
  /** `row` = fila horizontal (página); `stack` = apilado (dialog). */
  layout?: 'row' | 'stack'
}

export default function IngresoForm({ mes, anio, casas, monedas, editing, onSubmit, onCancelEdit, saving, layout = 'row' }: Props) {
  const [fecha, setFecha] = useState(fechaInicial(mes, anio))
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [casaId, setCasaId] = useState<number | null>(null)
  const [monedaId, setMonedaId] = useState<number | null>(null)
  const [tipoCambio, setTipoCambio] = useState('1')

  // ARS es el caso normal: se preselecciona apenas llegan las monedas (por código, no por id
  // hardcodeado). Si el usuario está editando, gana la moneda del ingreso.
  const monedaArs = useMemo(() => monedas.find((m) => m.codigo === 'ARS') ?? null, [monedas])
  const monedaSeleccionada = useMemo(() => monedas.find((m) => m.id === monedaId) ?? null, [monedas, monedaId])
  const esARS = monedaSeleccionada?.codigo === 'ARS'

  useEffect(() => {
    if (editing) {
      setFecha(editing.fecha)
      setMonto(String(editing.monto_moneda))
      setDescripcion(editing.descripcion ?? '')
      setCasaId(editing.casa_id)
      setMonedaId(editing.moneda_id)
      setTipoCambio(String(editing.tipo_cambio))
    } else {
      setFecha(fechaInicial(mes, anio))
      setMonto('')
      setDescripcion('')
      setCasaId(null)
      setMonedaId(monedaArs?.id ?? null)
      setTipoCambio('1')
    }
  }, [editing, mes, anio, monedaArs])

  const montoNum = Number(monto)
  const tcNum = esARS ? 1 : Number(tipoCambio)
  const montoArs = Number.isFinite(montoNum) && Number.isFinite(tcNum) ? montoNum * tcNum : 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fecha) {
      toast.error('Completá la fecha')
      return
    }
    if (monto.trim() === '' || !Number.isFinite(montoNum)) {
      toast.error('Completá el monto')
      return
    }
    if (monedaId == null) {
      toast.error('Elegí la moneda')
      return
    }
    if (!esARS && (!Number.isFinite(tcNum) || tcNum <= 0)) {
      toast.error('El tipo de cambio tiene que ser mayor a 0')
      return
    }
    // `mes`/`anio` van explícitos: el ingreso se imputa al mes que se está mirando aunque la
    // fecha del cobro caiga fuera de él. El tipo de cambio se fuerza a 1 en ARS.
    const ok = await onSubmit(
      {
        fecha,
        monto_moneda: montoNum,
        moneda_id: monedaId,
        tipo_cambio: esARS ? 1 : tcNum,
        descripcion,
        casa_id: casaId,
        mes,
        anio,
      },
      editing?.id,
    )
    if (ok && !editing) {
      setMonto('')
      setDescripcion('')
    }
    if (ok && editing) onCancelEdit()
  }

  // Acotar el date picker al mes visible.
  const mm = String(mes).padStart(2, '0')
  const ultimoDia = new Date(anio, mes, 0).getDate()

  const stack = layout === 'stack'

  return (
    <Box
      component="form"
      onSubmit={submit}
      sx={{
        display: 'flex',
        gap: { xs: 1.5, sm: 2 },
        flexDirection: { xs: 'column', sm: stack ? 'column' : 'row' },
        flexWrap: stack ? 'nowrap' : 'wrap',
        alignItems: { xs: 'stretch', sm: stack ? 'stretch' : 'flex-end' },
      }}
    >
      <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 2 }, flexDirection: { xs: 'column', sm: 'row' } }}>
        <AppDateField
          label="Fecha"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          size="small"
          inputProps={{ min: `${anio}-${mm}-01`, max: `${anio}-${mm}-${String(ultimoDia).padStart(2, '0')}` }}
          sx={{ minWidth: { xs: 'auto', sm: 160 } }}
        />
        <TextField
          label={`Monto (${monedaSeleccionada?.codigo ?? 'moneda'})`}
          type="number"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          size="small"
          inputProps={{ step: '0.01' }}
          sx={{ minWidth: { xs: 'auto', sm: 160 } }}
        />
      </Box>

      {/* Moneda — sólo tiene sentido mostrarla si hay más de una cargada. */}
      {monedas.length > 1 && (
        <AppSelect
          label="Moneda"
          options={monedas.map((m) => ({ value: m.id, label: `${m.simbolo} ${m.codigo} - ${m.nombre}` }))}
          value={monedaId}
          onChange={(v) => {
            const id = v == null ? null : Number(v)
            setMonedaId(id)
            // Volver a ARS deja el tipo de cambio en 1: ahí no hay conversión que hacer.
            if (id != null && monedas.find((m) => m.id === id)?.codigo === 'ARS') setTipoCambio('1')
          }}
          disableClearable
          sx={{ minWidth: { xs: 'auto', sm: 190 } }}
        />
      )}

      {/* Tipo de cambio + equivalente en ARS — sólo si la moneda no es ARS. */}
      {!esARS && (
        <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 2 }, flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'flex-end' } }}>
          <TextField
            label={`Tipo de cambio (${monedaSeleccionada?.codigo ?? ''} → ARS)`}
            type="number"
            value={tipoCambio}
            onChange={(e) => setTipoCambio(e.target.value)}
            size="small"
            // `step: 'any'` a propósito: con un step numérico el browser valida contra la base
            // del paso (el `min`), y una cotización como 1517.56 quedaba "inválida". Además las
            // cotizaciones pueden tener más de 2 decimales. El piso > 0 lo valida `submit` y,
            // del lado del server, `parseIngresoBody`.
            inputProps={{ step: 'any', min: 0 }}
            sx={{ minWidth: { xs: 'auto', sm: 190 } }}
          />
          <Box sx={{ minWidth: { xs: 'auto', sm: 160 }, pb: { sm: 0.5 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>En ARS</Typography>
            <Typography variant="body2" fontWeight={700}>{fmtARS(montoArs)}</Typography>
          </Box>
        </Box>
      )}

      <TextField
        label="Descripción"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        size="small"
        placeholder="Sueldo, alquiler cobrado, venta..."
        sx={{ minWidth: { xs: 'auto', sm: stack ? 'auto' : 220 }, flexGrow: stack ? 0 : 1 }}
      />

      {casas.length > 1 && (
        <AppSelect
          label="Casa"
          options={casas.map((c) => ({ value: c.id, label: c.nombre }))}
          value={casaId}
          onChange={(v) => setCasaId(v == null ? null : Number(v))}
          emptyLabel="General (todas)"
          sx={{ minWidth: { xs: 'auto', sm: 180 } }}
        />
      )}

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button type="submit" variant="contained" startIcon={<AddIcon />} disabled={saving} sx={{ flexGrow: stack ? 1 : 0 }}>
          {editing ? 'Guardar' : 'Agregar'}
        </Button>
        {editing && (
          <Button color="inherit" startIcon={<CloseIcon />} onClick={onCancelEdit}>
            Cancelar
          </Button>
        )}
      </Box>
    </Box>
  )
}
