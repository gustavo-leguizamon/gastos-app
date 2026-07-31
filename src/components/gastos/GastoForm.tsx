'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import BrandLogo from '@/components/shared/BrandLogo'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { gastoFormSchema } from '@/lib/gasto-form-schema'
import { normalizeNombre } from '@/lib/conceptos'
import { parseCuotas, formatCuotas } from '@/lib/cuotas'
import Grid from '@mui/material/Grid'
import TextField from '@/components/shared/AppTextField'
import Autocomplete from '@mui/material/Autocomplete'
import AppDateField from '@/components/shared/AppDateField'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ToggleButton from '@mui/material/ToggleButton'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import AppToggle from '@/components/shared/AppToggle'
import AppSelect from '@/components/shared/AppSelect'
import AppMultiSelect from '@/components/shared/AppMultiSelect'
import toast from 'react-hot-toast'
import type {
  Casa, Moneda, Tarjeta, Categoria, Etiqueta, Concepto, Gasto, GastoFormData, ConceptoDefaults,
} from '@/lib/types'

const byNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const schema = gastoFormSchema

/** Campos que el autofill por concepto puede escribir (para marcar su origen en el helper). */
type CampoAutofill = 'casa_id' | 'tipo_pago' | 'tarjeta_id' | 'moneda_id' | 'tipo_cambio' | 'categoria_id' | 'etiqueta_ids' | 'total_moneda'

interface Props {
  gasto?: Gasto | null
  defaultMes: number
  defaultAnio: number
  onSubmit: (data: GastoFormData) => Promise<void>
  formId: string
  /**
   * Cada incremento limpia el form para cargar otro gasto conservando el contexto
   * (fecha, casa, medio de pago, moneda). Lo usa "Guardar y cargar otro" de `GastoDialog`.
   */
  resetSignal?: number
}

export default function GastoForm({ gasto, defaultMes, defaultAnio, onSubmit, formId, resetSignal = 0 }: Props) {
  const [casas, setCasas] = useState<Casa[]>([])
  const [monedas, setMonedas] = useState<Moneda[]>([])
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [conceptos, setConceptos] = useState<Concepto[]>([])
  // Cuotas en un solo campo ("3/12"); el schema sigue recibiendo el par de números.
  const [cuotasTexto, setCuotasTexto] = useState(() => formatCuotas(gasto?.cuota_actual, gasto?.cuotas_totales))
  const [cuotasError, setCuotasError] = useState<string | null>(null)
  // Feedback del autofill: de qué mes salieron los valores y qué campos escribió.
  const [autofill, setAutofill] = useState<{ mes: number; anio: number; campos: CampoAutofill[] } | null>(null)
  // Sólo se evalúa al salir del campo descripción, para no titilar mientras se tipea.
  const [conceptoNuevo, setConceptoNuevo] = useState(false)
  const descripcionRef = useRef<HTMLInputElement | null>(null)
  const now = new Date()

  const isEditing = !!gasto

  const { control, handleSubmit, watch, setValue, getValues, reset, formState: { errors, dirtyFields } } = useForm<GastoFormData>({
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
      categoria_id: gasto?.categoria_id ?? null,
      etiqueta_ids: gasto?.etiqueta_ids ?? [],
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
      fetch('/api/etiquetas').then(r => r.json()).catch(() => []),
      fetch('/api/conceptos').then(r => r.json()).catch(() => []),
      fetch('/api/settings').then(r => r.json()).catch(() => null),
    ]).then(([c, m, t, l, e, cc, s]) => {
      setCasas(c)
      setMonedas(m)
      setTarjetas(t)
      setCategorias(l)
      setEtiquetas(Array.isArray(e) ? e : [])
      setConceptos(Array.isArray(cc) ? cc : [])
      if (!gasto) {
        // Casa por defecto configurada; si no hay, se autocompleta cuando existe una sola casa.
        const casaDefault = s?.casa_default_id != null && c.some((x: Casa) => x.id === s.casa_default_id)
          ? s.casa_default_id
          : (c.length === 1 ? c[0].id : null)
        if (casaDefault != null) setValue('casa_id', casaDefault)
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

  const monedaSeleccionada = useMemo(() => monedas.find(m => m.id === monedaId), [monedas, monedaId])
  const esARS = monedaSeleccionada?.codigo === 'ARS'
  const totalARS = (totalMoneda || 0) * (esARS ? 1 : (tipoCambio || 1))

  // Sugerencias de descripción: los conceptos más usados primero (el autocomplete filtra igual al tipear).
  const opcionesDescripcion = useMemo(
    () => [...conceptos].sort((a, b) => (b.uso ?? 0) - (a.uso ?? 0) || byNombre(a, b)).map(c => c.nombre),
    [conceptos],
  )

  // Cuando es tarjeta y se selecciona una tarjeta, la descripción se sincroniza con "Nombre (Banco)"
  useEffect(() => {
    if (esTarjeta && tarjetaId) {
      const t = tarjetas.find(x => x.id === tarjetaId)
      if (t) setValue('descripcion', t.banco ? `${t.nombre} (${t.banco})` : t.nombre)
    }
  }, [esTarjeta, tarjetaId, tarjetas, setValue])

  // "Guardar y cargar otro": limpia el gasto pero conserva el contexto de carga.
  useEffect(() => {
    if (!resetSignal) return
    const v = getValues()
    reset({
      ...v,
      descripcion: '',
      total_moneda: 0,
      total_pagado: 0,
      notas: '',
      categoria_id: null,
      etiqueta_ids: [],
      cuota_actual: null,
      cuotas_totales: null,
      confirmado: true,
      pagado_completo: true,
    })
    setCuotasTexto('')
    setCuotasError(null)
    setAutofill(null)
    setConceptoNuevo(false)
    descripcionRef.current?.focus()
  }, [resetSignal, getValues, reset])

  /**
   * Defaults aprendidos por concepto. Se dispara sólo al elegir del dropdown o al salir del campo
   * (nunca por tecla: "Luz de la casa" pasaría por "Luz" en el camino) y nunca sobreescribe un
   * campo que el usuario ya tocó.
   */
  const aplicarDefaultsDeConcepto = async (nombre: string) => {
    if (isEditing) return
    const limpio = normalizeNombre(nombre ?? '')
    if (!limpio) { setConceptoNuevo(false); setAutofill(null); return }

    const concepto = conceptos.find(c => normalizeNombre(c.nombre).toLowerCase() === limpio.toLowerCase())
    if (!concepto) {
      // Concepto nuevo: se crea al guardar (find-or-create en el write path). Nada que prefillear.
      setConceptoNuevo(true)
      setAutofill(null)
      return
    }
    setConceptoNuevo(false)

    const defaults: ConceptoDefaults | null = await fetch(`/api/conceptos/${concepto.id}/ultimo-uso`)
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
    if (!defaults) { setAutofill(null); return }

    // Objeto tipado contra GastoFormData: el cast queda sólo en `setValue` (el genérico de RHF
    // no resuelve el par campo/valor cuando la clave es una variable).
    const valores: Pick<GastoFormData, CampoAutofill> = {
      casa_id: defaults.casa_id,
      tipo_pago: defaults.tipo_pago,
      tarjeta_id: defaults.tarjeta_id,
      moneda_id: defaults.moneda_id,
      tipo_cambio: defaults.tipo_cambio,
      categoria_id: defaults.categoria_id,
      etiqueta_ids: defaults.etiqueta_ids,
      total_moneda: defaults.total_moneda,
    }

    const campos: CampoAutofill[] = []
    for (const campo of Object.keys(valores) as CampoAutofill[]) {
      if (dirtyFields[campo]) continue
      setValue(campo, valores[campo] as any)
      campos.push(campo)
    }

    // El monto heredado es una estimación, no un dato: queda sin confirmar (fondo naranja +
    // warning en la grilla). `pagado_completo` no se toca: sigue marcado por default siempre.
    if (campos.includes('total_moneda') && !dirtyFields.confirmado) {
      setValue('confirmado', false)
    }

    setAutofill({ mes: defaults.origen.mes, anio: defaults.origen.anio, campos })
  }

  /** Helper "de jun 2026" en los campos que escribió el autofill y el usuario todavía no tocó. */
  const origenHelper = (campo: CampoAutofill): string | undefined => {
    if (!autofill || !autofill.campos.includes(campo) || dirtyFields[campo]) return undefined
    return `de ${MESES_CORTOS[autofill.mes - 1]} ${autofill.anio}`
  }

  const handleCuotasChange = (texto: string) => {
    setCuotasTexto(texto)
    const parsed = parseCuotas(texto)
    if (!parsed.ok) { setCuotasError(parsed.error); return }
    setCuotasError(null)
    setValue('cuota_actual', parsed.cuota_actual)
    setValue('cuotas_totales', parsed.cuotas_totales)
  }

  // Medio de pago unificado: débito o una tarjeta concreta (colapsa tipo_pago + tarjeta_id).
  // En un resumen de tarjeta (`es_tarjeta`) se mantienen los dos controles separados, porque ahí
  // la tarjeta es opcional y puede convivir con tipo_pago 'D'.
  const medioPagoValue = tipoPago === 'C' ? (tarjetaId ? `C:${tarjetaId}` : null) : 'D'
  const medioPagoOptions = useMemo(() => ([
    { value: 'D', label: 'Débito / Efectivo' },
    ...tarjetas.map(t => ({
      value: `C:${t.id}`,
      label: `${t.nombre}${t.banco ? ` (${t.banco})` : ''}`,
      render: () => (
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          <BrandLogo marca={t.marca} width={30} height={22} />
          <span>{t.nombre}{t.banco ? ` (${t.banco})` : ''}</span>
        </Box>
      ),
      adornment: () => <BrandLogo marca={t.marca} width={30} height={22} />,
    })),
  ]), [tarjetas])

  // Alta inline de categoría/etiqueta desde el propio form.
  const crearCategoria = async (nombre: string) => {
    try {
      const res = await fetch('/api/categorias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre }) })
      if (!res.ok) throw new Error()
      const c = await res.json()
      setCategorias(prev => [...prev, c].sort(byNombre))
      return { value: c.id, label: c.nombre }
    } catch { toast.error('Error al crear categoría'); return null }
  }
  const crearEtiqueta = async (nombre: string) => {
    try {
      const res = await fetch('/api/etiquetas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre }) })
      if (!res.ok) throw new Error()
      const e = await res.json()
      setEtiquetas(prev => [...prev, e].sort(byNombre))
      return { value: e.id, label: e.nombre }
    } catch { toast.error('Error al crear etiqueta'); return null }
  }

  const tarjetaSelect = (
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
            adornment: () => <BrandLogo marca={t.marca} width={30} height={22} />,
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
  )

  return (
    <Box component="form" id={formId} onSubmit={handleSubmit(onSubmit)}>
      <Grid container spacing={2}>
        {/* Descripción — primer campo: es el que dispara el autofill por concepto */}
        <Grid item xs={12} sm={8}>
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
                  options={opcionesDescripcion}
                  value={field.value || ''}
                  onInputChange={(_, val) => field.onChange(val)}
                  onChange={(_, val) => {
                    const nombre = val ?? ''
                    field.onChange(nombre)
                    aplicarDefaultsDeConcepto(nombre)
                  }}
                  onBlur={() => aplicarDefaultsDeConcepto(field.value || '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      inputRef={descripcionRef}
                      autoFocus={!isEditing}
                      fullWidth
                      label="Descripción"
                      size="small"
                      error={!!errors.descripcion}
                      helperText={
                        errors.descripcion?.message ??
                        (conceptoNuevo
                          ? 'Concepto nuevo: se crea al guardar. Revisá que no sea un typo de uno existente.'
                          : autofill
                            ? `Prefilleado con el último uso (${MESES_CORTOS[autofill.mes - 1]} ${autofill.anio})`
                            : 'Sugerencias de conceptos ya usados')
                      }
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {conceptoNuevo && <Chip size="small" color="info" variant="outlined" label="nuevo concepto" sx={{ mr: 1 }} />}
                            {!conceptoNuevo && autofill && (
                              <AutoAwesomeIcon fontSize="small" color="info" sx={{ mr: 1 }} />
                            )}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              )
            )}
          />
        </Grid>

        {/* Total en moneda */}
        <Grid item xs={12} sm={4}>
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
                helperText={errors.total_moneda?.message ?? origenHelper('total_moneda')}
              />
            )}
          />
        </Grid>

        {/* Tipo cambio + total ARS — sólo si la moneda no es ARS */}
        {!esARS && (
          <>
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
                    helperText={errors.tipo_cambio?.message ?? origenHelper('tipo_cambio')}
                  />
                )}
              />
            </Grid>
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
          </>
        )}

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

        {/* Medio de pago — débito o tarjeta (en resumen de tarjeta van los dos controles aparte) */}
        {esTarjeta ? (
          <>
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
            <Grid item xs={12} sm={6}>{tarjetaSelect}</Grid>
          </>
        ) : (
          <Grid item xs={12} sm={6}>
            <AppSelect
              label="Medio de pago"
              options={medioPagoOptions}
              value={medioPagoValue}
              onChange={(v) => {
                if (v === 'D' || v == null) {
                  setValue('tipo_pago', 'D', { shouldDirty: true })
                  setValue('tarjeta_id', null, { shouldDirty: true })
                  return
                }
                setValue('tipo_pago', 'C', { shouldDirty: true })
                setValue('tarjeta_id', Number(String(v).slice(2)), { shouldDirty: true })
              }}
              fullWidth
              error={!!errors.tarjeta_id}
              helperText={errors.tarjeta_id?.message ?? origenHelper('tarjeta_id') ?? origenHelper('tipo_pago')}
              disableClearable
            />
          </Grid>
        )}

        {/* Todo lo que tiene un default correcto en la mayoría de las cargas */}
        <Grid item xs={12}>
          <Accordion defaultExpanded={isEditing} disableGutters elevation={0} sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, minHeight: 40 }}>
              <Typography variant="body2" color="text.secondary">Más opciones</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0, pt: 0 }}>
              <Grid container spacing={2}>
                {/* Categoría (única — partición) */}
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="categoria_id"
                    control={control}
                    render={({ field }) => (
                      <AppSelect
                        label="Categoría"
                        options={categorias.map(c => ({ value: c.id, label: c.nombre }))}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v == null ? null : Number(v))}
                        fullWidth
                        emptyLabel="Sin categoría"
                        helperText={origenHelper('categoria_id')}
                        onCreate={crearCategoria}
                      />
                    )}
                  />
                </Grid>

                {/* Etiquetas (varias — corte transversal) */}
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="etiqueta_ids"
                    control={control}
                    render={({ field }) => (
                      <AppMultiSelect
                        label="Etiquetas (opcional)"
                        options={etiquetas.map(e => ({ value: e.id, label: e.nombre }))}
                        value={field.value ?? []}
                        onChange={(v) => field.onChange(v.map(Number))}
                        fullWidth
                        placeholder="Sin etiquetas"
                        onCreate={crearEtiqueta}
                      />
                    )}
                  />
                </Grid>

                {/* Casa — con default configurable, casi nunca hay que tocarla */}
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
                        helperText={errors.casa_id?.message ?? origenHelper('casa_id')}
                        disableClearable
                      />
                    )}
                  />
                </Grid>

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
                        helperText={errors.moneda_id?.message ?? origenHelper('moneda_id')}
                        disableClearable
                      />
                    )}
                  />
                </Grid>

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
                          inputProps={{ step: 0.01 }}
                          error={!!errors.total_pagado}
                          helperText={isEditing ? errors.total_pagado?.message : (errors.total_pagado?.message ?? 'Si es distinto de 0, se crea un pago con la fecha del gasto')}
                        />
                      )}
                    />
                  </Grid>
                )}

                {/* Cuotas en un solo campo */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Cuotas (opcional)"
                    size="small"
                    value={cuotasTexto}
                    onChange={e => handleCuotasChange(e.target.value)}
                    placeholder="3/12"
                    error={!!cuotasError || !!errors.cuota_actual || !!errors.cuotas_totales}
                    helperText={cuotasError ?? 'Formato 3/12. Un solo número (12) equivale a 1/12. Vacío = sin cuotas.'}
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
                            inputProps={{ step: 0.01 }}
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
                            inputProps={{ step: 0.01 }}
                            error={!!errors.prestamo_a_otro}
                            helperText={errors.prestamo_a_otro?.message}
                          />
                        )}
                      />
                    </Grid>
                  </>
                )}

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

                {/* Es tarjeta de crédito */}
                <Grid item xs={12}>
                  <Controller
                    name="es_tarjeta"
                    control={control}
                    render={({ field }) => (
                      <AppToggle
                        checked={!!field.value}
                        onChange={e => field.onChange(e.target.checked)}
                        label={
                          <Box>
                            <Typography variant="body2">Este gasto es una tarjeta de crédito (resumen del mes)</Typography>
                            <Typography variant="caption" color="text.secondary">
                              La descripción pasa a sincronizarse con la tarjeta elegida
                            </Typography>
                          </Box>
                        }
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>
    </Box>
  )
}
