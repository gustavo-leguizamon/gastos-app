'use client'

import { useMemo } from 'react'
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'

/**
 * Select estándar de la app — wrapper de MUI `Autocomplete` con API simplificada.
 * Permite tipear para filtrar entre las opciones disponibles. Reemplaza a `Select`
 * en toda la app cuando hay múltiples opciones.
 *
 * Si se pasa `onCreate`, habilita crear una opción nueva tipeando (aparece "Agregar «X»").
 */

export type AppSelectValue = string | number

export interface AppSelectOption {
  value: AppSelectValue
  label: string
  /** Render opcional para mostrar contenido rico (íconos, etc.) dentro del item del dropdown. */
  render?: () => React.ReactNode
}

interface CreatableOption extends AppSelectOption {
  inputValue?: string
  __create?: boolean
}

interface AppSelectProps {
  label: string
  options: AppSelectOption[]
  value: AppSelectValue | null
  onChange: (value: AppSelectValue | null) => void
  size?: 'small' | 'medium'
  fullWidth?: boolean
  sx?: any
  error?: boolean
  helperText?: string
  /** Si está seteado, agrega una opción al inicio con este label que representa value=null. */
  emptyLabel?: string
  /** Oculta el botón "X" para limpiar el valor. */
  disableClearable?: boolean
  placeholder?: string
  /** Si se provee, permite crear una opción nueva tipeando: debe persistirla y devolver la opción creada (o null si falla). */
  onCreate?: (nombre: string) => Promise<AppSelectOption | null>
}

const EMPTY_SENTINEL = '__app_select_empty__'
const filter = createFilterOptions<CreatableOption>()

export default function AppSelect({
  label,
  options,
  value,
  onChange,
  size = 'small',
  fullWidth,
  sx,
  error,
  helperText,
  emptyLabel,
  disableClearable,
  placeholder,
  onCreate,
}: AppSelectProps) {
  const allOptions = useMemo<AppSelectOption[]>(() => {
    if (emptyLabel != null) {
      return [{ value: EMPTY_SENTINEL, label: emptyLabel }, ...options]
    }
    return options
  }, [options, emptyLabel])

  const selectedOption = useMemo<AppSelectOption | null>(() => {
    if (value == null) {
      return emptyLabel != null ? allOptions[0] : null
    }
    return options.find(o => o.value === value) ?? null
  }, [options, value, emptyLabel, allOptions])

  return (
    <Autocomplete
      freeSolo={!!onCreate}
      selectOnFocus={!!onCreate}
      clearOnBlur={!!onCreate}
      handleHomeEndKeys
      options={allOptions as CreatableOption[]}
      value={selectedOption as any}
      onChange={async (_, newValue) => {
        if (newValue == null) { onChange(null); return }
        if (typeof newValue === 'string') {
          if (onCreate && newValue.trim()) {
            const created = await onCreate(newValue.trim())
            onChange(created ? created.value : null)
          }
          return
        }
        const o = newValue as CreatableOption
        if (o.__create) {
          const created = onCreate ? await onCreate(o.inputValue ?? '') : null
          onChange(created ? created.value : null)
          return
        }
        onChange(o.value === EMPTY_SENTINEL ? null : o.value)
      }}
      filterOptions={onCreate ? (opts, params) => {
        const filtered = filter(opts, params)
        const q = params.inputValue.trim()
        if (q !== '' && !opts.some(o => o.label.toLowerCase() === q.toLowerCase())) {
          filtered.push({ value: `__create__${q}`, label: `Agregar "${q}"`, inputValue: q, __create: true })
        }
        return filtered
      } : undefined}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
      isOptionEqualToValue={(option, val) => typeof option !== 'string' && typeof val !== 'string' && option.value === val.value}
      renderOption={(props, option) => {
        const { key, ...rest } = props as any
        const o = option as CreatableOption
        return (
          <li key={String(o.value)} {...rest}>
            {o.__create ? o.label : (o.render ? o.render() : o.label)}
          </li>
        )
      }}
      disableClearable={disableClearable}
      size={size}
      fullWidth={fullWidth}
      sx={sx}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          size={size}
          error={error}
          helperText={helperText}
          placeholder={placeholder}
        />
      )}
    />
  )
}
