'use client'

import { useEffect, useState, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ToggleButton from '@mui/material/ToggleButton'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import FormHelperText from '@mui/material/FormHelperText'
import type { Casa, Moneda, Tarjeta, Gasto, GastoFormData } from '@/lib/types'

const schema = yup.object({
  fecha_vencimiento: yup.string().required('Requerido'),
  descripcion: yup.string().required('Requerido').max(200),
  casa_id: yup.number().required('Requerido').min(1, 'Seleccioná una casa'),
  tipo_pago: yup.string().oneOf(['C', 'D']).required('Requerido'),
  moneda_id: yup.number().required('Requerido').min(1, 'Seleccioná una moneda'),
  tipo_cambio: yup.number().required('Requerido').min(0.0001, 'Debe ser > 0'),
  total_moneda: yup.number().required('Requerido').min(0, 'Debe ser >= 0'),
  total_pagado: yup.number().min(0, 'Debe ser >= 0').required('Requerido'),
  pasaje_mes_siguiente: yup.number().min(0).required('Requerido'),
  prestamo_a_otro: yup.number().min(0).required('Requerido'),
  tarjeta_id: yup.number().nullable().optional(),
  cuota_actual: yup.number().nullable().optional().min(1, 'Debe ser >= 1'),
  cuotas_totales: yup.number().nullable().optional().min(1, 'Debe ser >= 1'),
  mes: yup.number().required(),
  anio: yup.number().required(),
  notas: yup.string().optional().default(''),
})

interface Props {
  gasto?: Gasto | null
  defaultMes: number
  defaultAnio: number
  onSubmit: (data: GastoFormData) => Promise<void>
  formId: string
}

export default function GastoForm({ gasto, defaultMes, defaultAnio, onSubmit, formId }: Props) {
  const [casas, setCasas] = useState<Casa[]>([])
  const [monedas, setMonedas] = useState<Moneda[]>([])
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([])
  const now = new Date()

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<GastoFormData>({
    resolver: yupResolver(schema) as any,
    defaultValues: {
      fecha_vencimiento: gasto?.fecha_vencimiento ?? `${defaultAnio}-${String(defaultMes).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,
      descripcion: gasto?.descripcion ?? '',
      casa_id: gasto?.casa_id ?? 0,
      tipo_pago: gasto?.tipo_pago ?? 'D',
      moneda_id: gasto?.moneda_id ?? 0,
      tipo_cambio: gasto?.tipo_cambio ?? 1,
      total_moneda: gasto?.total_moneda ?? 0,
      total_pagado: gasto?.total_pagado ?? 0,
      pasaje_mes_siguiente: gasto?.pasaje_mes_siguiente ?? 0,
      prestamo_a_otro: gasto?.prestamo_a_otro ?? 0,
      tarjeta_id: gasto?.tarjeta_id ?? null,
      cuota_actual: gasto?.cuota_actual ?? null,
      cuotas_totales: gasto?.cuotas_totales ?? null,
      mes: gasto?.mes ?? defaultMes,
      anio: gasto?.anio ?? defaultAnio,
      notas: gasto?.notas ?? '',
    },
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/casas').then(r => r.json()),
      fetch('/api/monedas').then(r => r.json()),
      fetch('/api/tarjetas').then(r => r.json()),
    ]).then(([c, m, t]) => {
      setCasas(c)
      setMonedas(m)
      setTarjetas(t)
      if (!gasto) {
        if (c.length === 1) setValue('casa_id', c[0].id)
        const ars = m.find((x: Moneda) => x.codigo === 'ARS')
        if (ars) setValue('moneda_id', ars.id)
      }
    })
  }, [gasto, setValue])

  const tipoPago = watch('tipo_pago')
  const monedaId = watch('moneda_id')
  const tipoCambio = watch('tipo_cambio')
  const totalMoneda = watch('total_moneda')

  const monedaSeleccionada = useMemo(() => monedas.find(m => m.id === monedaId), [monedas, monedaId])
  const esARS = monedaSeleccionada?.codigo === 'ARS'
  const totalARS = (totalMoneda || 0) * (esARS ? 1 : (tipoCambio || 1))

  return (
    <Box component="form" id={formId} onSubmit={handleSubmit(onSubmit)}>
      <Grid container spacing={2}>
        {/* Fecha vencimiento */}
        <Grid item xs={12} sm={6}>
          <Controller
            name="fecha_vencimiento"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Fecha de Vencimiento"
                type="date"
                size="small"
                InputLabelProps={{ shrink: true }}
                error={!!errors.fecha_vencimiento}
                helperText={errors.fecha_vencimiento?.message}
                onClick={e => (e.currentTarget.querySelector('input') as any)?.showPicker?.()}
              />
            )}
          />
        </Grid>

        {/* Casa */}
        <Grid item xs={12} sm={6}>
          <Controller
            name="casa_id"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth size="small" error={!!errors.casa_id}>
                <InputLabel>Casa</InputLabel>
                <Select {...field} label="Casa" value={field.value || ''}>
                  {casas.map(c => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
                </Select>
                {errors.casa_id && <FormHelperText>{errors.casa_id.message}</FormHelperText>}
              </FormControl>
            )}
          />
        </Grid>

        {/* Descripcion */}
        <Grid item xs={12}>
          <Controller
            name="descripcion"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Descripción"
                size="small"
                error={!!errors.descripcion}
                helperText={errors.descripcion?.message}
              />
            )}
          />
        </Grid>

        {/* Tipo pago */}
        <Grid item xs={12} sm={6}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            Tipo de Pago
          </Typography>
          <Controller
            name="tipo_pago"
            control={control}
            render={({ field }) => (
              <ToggleButtonGroup
                exclusive
                size="small"
                value={field.value}
                onChange={(_, v) => { if (v) { field.onChange(v); if (v === 'D') setValue('tarjeta_id', null) } }}
              >
                <ToggleButton value="C" sx={{ px: 3 }}>Crédito (C)</ToggleButton>
                <ToggleButton value="D" sx={{ px: 3 }}>Débito (D)</ToggleButton>
              </ToggleButtonGroup>
            )}
          />
        </Grid>

        {/* Tarjeta (solo credito) */}
        {tipoPago === 'C' && (
          <Grid item xs={12} sm={6}>
            <Controller
              name="tarjeta_id"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth size="small">
                  <InputLabel>Tarjeta</InputLabel>
                  <Select {...field} label="Tarjeta" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}>
                    <MenuItem value="">Sin especificar</MenuItem>
                    {tarjetas.map(t => <MenuItem key={t.id} value={t.id}>{t.nombre}{t.banco ? ` (${t.banco})` : ''}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
            />
          </Grid>
        )}

        {/* Moneda */}
        <Grid item xs={12} sm={6}>
          <Controller
            name="moneda_id"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth size="small" error={!!errors.moneda_id}>
                <InputLabel>Moneda</InputLabel>
                <Select {...field} label="Moneda" value={field.value || ''} onChange={(e) => { field.onChange(Number(e.target.value)); if (monedas.find(m => m.id === Number(e.target.value))?.codigo === 'ARS') setValue('tipo_cambio', 1) }}>
                  {monedas.map(m => <MenuItem key={m.id} value={m.id}>{m.simbolo} {m.codigo} - {m.nombre}</MenuItem>)}
                </Select>
                {errors.moneda_id && <FormHelperText>{errors.moneda_id.message}</FormHelperText>}
              </FormControl>
            )}
          />
        </Grid>

        {/* Tipo cambio */}
        <Grid item xs={12} sm={6}>
          <Controller
            name="tipo_cambio"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label={esARS ? 'Tipo de Cambio (ARS)' : `Tipo de Cambio (${monedaSeleccionada?.codigo ?? ''} → ARS)`}
                type="number"
                size="small"
                inputProps={{ step: 0.01, min: 0 }}
                error={!!errors.tipo_cambio}
                helperText={errors.tipo_cambio?.message}
                disabled={esARS}
              />
            )}
          />
        </Grid>

        {/* Total en moneda */}
        <Grid item xs={12} sm={6}>
          <Controller
            name="total_moneda"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label={`Total (${monedaSeleccionada?.codigo ?? 'moneda'})`}
                type="number"
                size="small"
                inputProps={{ step: 0.01, min: 0 }}
                error={!!errors.total_moneda}
                helperText={errors.total_moneda?.message}
              />
            )}
          />
        </Grid>

        {/* Total ARS calculado */}
        {!esARS && (
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Total en ARS (calculado)"
              value={new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalARS)}
              size="small"
              InputProps={{ readOnly: true }}
              sx={{ '& input': { color: 'primary.main', fontWeight: 600 } }}
            />
          </Grid>
        )}

        {/* Total pagado */}
        <Grid item xs={12} sm={6}>
          <Controller
            name="total_pagado"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Total Pagado (ARS)"
                type="number"
                size="small"
                inputProps={{ step: 0.01, min: 0 }}
                error={!!errors.total_pagado}
                helperText={errors.total_pagado?.message}
              />
            )}
          />
        </Grid>

        {/* Pasaje mes siguiente */}
        <Grid item xs={12} sm={6}>
          <Controller
            name="pasaje_mes_siguiente"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Pasaje Mes Siguiente (ARS)"
                type="number"
                size="small"
                inputProps={{ step: 0.01, min: 0 }}
                error={!!errors.pasaje_mes_siguiente}
                helperText={errors.pasaje_mes_siguiente?.message}
              />
            )}
          />
        </Grid>

        {/* Prestamo a otro */}
        <Grid item xs={12} sm={6}>
          <Controller
            name="prestamo_a_otro"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Préstamo a otra persona (ARS)"
                type="number"
                size="small"
                inputProps={{ step: 0.01, min: 0 }}
                error={!!errors.prestamo_a_otro}
                helperText={errors.prestamo_a_otro?.message}
              />
            )}
          />
        </Grid>

        {/* Cuotas */}
        <Grid item xs={12} sm={6}>
          <Controller
            name="cuota_actual"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                fullWidth
                label="Cuota actual (opcional)"
                type="number"
                size="small"
                inputProps={{ min: 1, step: 1 }}
                error={!!errors.cuota_actual}
                helperText={errors.cuota_actual?.message}
              />
            )}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Controller
            name="cuotas_totales"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                fullWidth
                label="Total de cuotas (opcional)"
                type="number"
                size="small"
                inputProps={{ min: 1, step: 1 }}
                error={!!errors.cuotas_totales}
                helperText={errors.cuotas_totales?.message}
              />
            )}
          />
        </Grid>

        {/* Notas */}
        <Grid item xs={12}>
          <Controller
            name="notas"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Notas (opcional)"
                multiline
                rows={2}
                size="small"
              />
            )}
          />
        </Grid>
      </Grid>
    </Box>
  )
}
