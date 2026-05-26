'use client'

import { useMemo } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'

/**
 * Select estándar de la app — wrapper de MUI `Autocomplete` con API simplificada.
 * Permite tipear para filtrar entre las opciones disponibles. Reemplaza a `Select`
 * en toda la app cuando hay múltiples opciones.
 *
 * Para selects con muy pocas opciones (2-3), un `Select` clásico sigue siendo válido.
 */

export type AppSelectValue = string | number

export interface AppSelectOption {
  value: AppSelectValue
  label: string
  /** Render opcional para mostrar contenido rico (íconos, etc.) dentro del item del dropdown. */
  render?: () => React.ReactNode
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
}

const EMPTY_SENTINEL = '__app_select_empty__'

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
      options={allOptions}
      value={selectedOption}
      onChange={(_, newValue) => {
        if (newValue == null || newValue.value === EMPTY_SENTINEL) {
          onChange(null)
        } else {
          onChange(newValue.value)
        }
      }}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, val) => option.value === val.value}
      renderOption={(props, option) => {
        const { key, ...rest } = props as any
        return (
          <li key={option.value} {...rest}>
            {option.render ? option.render() : option.label}
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
