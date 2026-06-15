'use client'

import { useEffect, useState, useMemo } from 'react'
import BrandLogo from '@/components/shared/BrandLogo'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import Grid from '@mui/material/Grid'
import TextField from '@/components/shared/AppTextField'
import Autocomplete from '@mui/material/Autocomplete'
import AppDateField from '@/components/shared/AppDateField'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ToggleButton from '@mui/material/ToggleButton'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import AppToggle from '@/components/shared/AppToggle'
import AppSelect from '@/components/shared/AppSelect'
import AppMultiSelect from '@/components/shared/AppMultiSelect'
import type { Casa, Moneda, Tarjeta, Categoria, Gasto, GastoFormData } from '@/lib/types'

const schema = yup.object({
  fecha_vencimiento: yup.string().required('Requerido'),
  descripcion: yup.string().required('Requerido').max(200),
  casa_id: yup.number().required('Requerido').min(1, 'Seleccioná una casa'),
  tipo_pago: yup.string().oneOf(['C', 'D']).required('Requerido'),
  moneda_id: yup.number().required('Requerido').min(1, 'Seleccioná una moneda'),
  tipo_cambio: yup.number().required('Requerido').min(0.0001, 'Debe ser > 0'),
  total_moneda: yup.number().required('Requerido'),
  total_pagado: yup.number().min(0, 'Debe ser >= 0').required('Requerido'),
  pasaje_mes_siguiente: yup.number().min(0).required('Requerido'),
  prestamo_a_otro: yup.number().min(0).required('Requerido'),
  tarjeta_id: yup
    .number()
    .nullable()
    .when('tipo_pago', {
      is: 'C',
      then: (s) => s.typeError('Seleccioná una tarjeta').required('Seleccioná una tarjeta').min(1, 'Seleccioná una tarjeta'),
      otherwise: (s) => s.optional(),
    }),
  cuota_actual: yup.number().nullable().optional().min(1, 'Debe ser >= 1'),
  cuotas_totales: yup.number().nullable().optional().min(1, 'Debe ser >= 1'),
  mes: yup.number().required(),
  anio: yup.number().required(),
  notas: yup.string().optional().default(''),
  confirmado: yup.boolean().required().default(true),
  categoria_ids: yup.array().of(yup.number()).default([]),
  es_tarjeta: yup.boolean().required().default(false),
  pagado_completo: yup.boolean().required().default(false),
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
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [descripciones, setDescripciones] = useState<string[]>([])
  const [usaCuotas, setUsaCuotas] = useState<boolean>(!!(gasto?.cuota_actual ?? gasto?.cuotas_totales))
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
      confirmado: gasto?.confirmado ?? true,
      categoria_ids: gasto?.categoria_ids ?? [],
      es_tarjeta: gasto?.es_tarjeta ?? false,
      pagado_completo: true,
    },
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/casas').then(r => r.json()),
      fetch('/api/monedas').then(r => r.json()),
      fetch('/api/tarjetas').then(r => r.json()),
      fetch('/api/categorias').then(r => r.json()),
      fetch('/api/gastos/descripciones').then(r => r.json()).catch(() => []),
    ]).then(([c, m, t, l, d]) => {
      setCasas(c)
      setMonedas(m)
      setTarjetas(t)
      setCategorias(l)
      setDescripciones(Array.isArray(d) ? d : [])
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
  const esTarjeta = watch('es_tarjeta')
  const tarjetaId = watch('tarjeta_id')
  const pagadoCompleto = watch('pagado_completo')

  const isEditing = !!gasto
  const monedaSeleccionada = useMemo(() => monedas.find(m => m.id === monedaId), [monedas, monedaId])
  const esARS = monedaSeleccionada?.codigo === 'ARS'
  const totalARS = (totalMoneda || 0) * (esARS ? 1 : (tipoCambio || 1))

  // Cuando es tarjeta y se selecciona una tarjeta, la descripción se sincroniza con "Nombre (Banco)"
  useEffect(() => {
    if (esTarjeta && tarjetaId) {
      const t = tarjetas.find(x => x.id === tarjetaId)
      if (t) setValue('descripcion', t.banco ? `${t.nombre} (${t.banco})` : t.nombre)
    }
  }, [esTarjeta, tarjetaId, tarjetas, setValue])

  return (
    <Box component="form" id={formId} onSubmit={handleSubmit(onSubmit)}>
      <Grid container spacing={2}>
        {/* Fecha vencimiento */}
        <Grid item xs={12} sm={6}>
          <Controller
            name="fecha_vencimiento"
            control={control}
            render={({ field }) => (
              <AppDateField
                {...field}
                fullWidth
                label="Fecha de Vencimiento"
                size="small"
                error={!!errors.fecha_vencimiento}
                helperText={errors.fecha_vencimiento?.message}
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
              <AppSelect
                label="Casa"
                options={casas.map(c => ({ value: c.id, label: c.nombre }))}
                value={field.value ?? null}
                onChange={(v) => field.onChange(v)}
                fullWidth
                error={!!errors.casa_id}
                helperText={errors.casa_id?.message}
                disableClearable
              />
            )}
          />
        </Grid>

        {/* Es tarjeta de crédito */}
        <Grid item xs={12}>
          <Controller
            name="es_tarjeta"
            control={control}
            render={({ field }) => (
              <AppToggle
                checked={!!field.value}
                onChange={e => field.onChange(e.target.checked)}
                label={<Typography variant="body2">Este gasto es una tarjeta de crédito (resumen del mes)</Typography>}
              />
            )}
          />
        </Grid>

        {/* Descripcion */}
        <Grid item xs={12}>
          <Controller
            name="descripcion"
            control={control}
            render={({ field }) => (
              esTarjeta ? (
                <TextField
                  {...field}
                  fullWidth
                  label="Descripción"
                  size="small"
                  disabled
                  helperText="Se sincroniza con la tarjeta seleccionada"
                />
              ) : (
                <Autocomplete
                  freeSolo
                  options={descripciones}
                  value={field.value || ''}
                  onInputChange={(_, val) => field.onChange(val)}
                  onChange={(_, val) => field.onChange(val ?? '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      label="Descripción"
                      size="small"
                      error={!!errors.descripcion}
                      helperText={errors.descripcion?.message ?? 'Sugerencias de descripciones ya usadas'}
                    />
                  )}
                />
              )
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

        {/* Tarjeta (crédito o resumen de tarjeta) */}
        {(tipoPago === 'C' || esTarjeta) && (
          <Grid item xs={12} sm={6}>
            <Controller
              name="tarjeta_id"
              control={control}
              render={({ field }) => (
                <AppSelect
                  label={`Tarjeta${tipoPago === 'C' ? '' : ' (opcional)'}`}
                  options={tarjetas.map(t => ({
                    value: t.id,
                    label: `${t.nombre}${t.banco ? ` (${t.banco})` : ''}`,
                    render: () => (
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                        <BrandLogo marca={t.marca} width={30} height={22} />
                        <span>{t.nombre}{t.banco ? ` (${t.banco})` : ''}</span>
                      </Box>
                    ),
                  }))}
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v == null ? null : Number(v))}
                  fullWidth
                  error={!!errors.tarjeta_id}
                  helperText={errors.tarjeta_id?.message}
                  emptyLabel={tipoPago === 'C' ? undefined : 'Sin especificar'}
                  disableClearable={tipoPago === 'C'}
                />
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
              <AppSelect
                label="Moneda"
                options={monedas.map(m => ({ value: m.id, label: `${m.simbolo} ${m.codigo} - ${m.nombre}` }))}
                value={field.value ?? null}
                onChange={(v) => {
                  const id = v == null ? null : Number(v)
                  field.onChange(id)
                  if (id != null && monedas.find(m => m.id === id)?.codigo === 'ARS') setValue('tipo_cambio', 1)
                }}
                fullWidth
                error={!!errors.moneda_id}
                helperText={errors.moneda_id?.message}
                disableClearable
              />
            )}
          />
        </Grid>

        {/* Tipo cambio — solo si no es ARS */}
        {!esARS && (
          <Grid item xs={12} sm={6}>
            <Controller
              name="tipo_cambio"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={`Tipo de Cambio (${monedaSeleccionada?.codigo ?? ''} → ARS)`}
                  type="number"
                  size="small"
                  inputProps={{ step: 0.01, min: 0 }}
                  error={!!errors.tipo_cambio}
                  helperText={errors.tipo_cambio?.message}
                />
              )}
            />
          </Grid>
        )}

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
                inputProps={{ step: 0.01 }}
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

        {/* Pagado completo — solo en alta */}
        {!isEditing && (
          <Grid item xs={12}>
            <Controller
              name="pagado_completo"
              control={control}
              render={({ field }) => (
                <AppToggle
                  checked={!!field.value}
                  onChange={e => {
                    field.onChange(e.target.checked)
                    if (e.target.checked) setValue('total_pagado', 0)
                  }}
                  label={<Typography variant="body2">Ya fue pagado en su totalidad (se registra un pago automático por el total al guardar)</Typography>}
                />
              )}
            />
          </Grid>
        )}

        {/* Total pagado — oculto si está marcado "pagado completo" */}
        {!(pagadoCompleto && !isEditing) && (
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
                  helperText={isEditing ? errors.total_pagado?.message : (errors.total_pagado?.message ?? 'Si > 0, se crea un pago con la fecha del gasto')}
                />
              )}
            />
          </Grid>
        )}

        {/* Pasaje / Préstamo — solo en edición */}
        {isEditing && (
          <>
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
          </>
        )}

        {/* Toggle: usa cuotas */}
        <Grid item xs={12}>
          <AppToggle
            checked={usaCuotas}
            onChange={e => {
              setUsaCuotas(e.target.checked)
              if (!e.target.checked) {
                setValue('cuota_actual', null)
                setValue('cuotas_totales', null)
              }
            }}
            label={<Typography variant="body2">Pago en cuotas</Typography>}
          />
        </Grid>

        {/* Cuotas (solo si usa cuotas) */}
        {usaCuotas && (
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Controller
                name="cuota_actual"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                    label="Cuota"
                    type="number"
                    size="small"
                    sx={{ width: 90 }}
                    inputProps={{ min: 1, step: 1 }}
                    error={!!errors.cuota_actual}
                    helperText={errors.cuota_actual?.message}
                  />
                )}
              />
              <Typography sx={{ mt: 1, color: 'text.secondary' }}>/</Typography>
              <Controller
                name="cuotas_totales"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                    label="Total"
                    type="number"
                    size="small"
                    sx={{ width: 90 }}
                    inputProps={{ min: 1, step: 1 }}
                    error={!!errors.cuotas_totales}
                    helperText={errors.cuotas_totales?.message}
                  />
                )}
              />
            </Box>
          </Grid>
        )}

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

        {/* Categorias */}
        <Grid item xs={12} sm={6}>
          <Controller
            name="categoria_ids"
            control={control}
            render={({ field }) => (
              <AppMultiSelect
                label="Categorías (opcional)"
                options={categorias.map(l => ({ value: l.id, label: l.nombre }))}
                value={field.value ?? []}
                onChange={(v) => field.onChange(v.map(Number))}
                fullWidth
                placeholder="Sin especificar"
              />
            )}
          />
        </Grid>

        {/* Confirmado */}
        <Grid item xs={12}>
          <Controller
            name="confirmado"
            control={control}
            render={({ field }) => (
              <AppToggle
                checked={!!field.value}
                onChange={e => field.onChange(e.target.checked)}
                color="warning"
                label={
                  <Box>
                    <Typography variant="body2">Gasto confirmado</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Desmarcá si el monto aún no está confirmado
                    </Typography>
                  </Box>
                }
              />
            )}
          />
        </Grid>
      </Grid>
    </Box>
  )
}
