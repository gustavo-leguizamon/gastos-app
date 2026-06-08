'use client'

import { useMemo } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'

/**
 * Multi-select estándar de la app — wrapper de MUI `Autocomplete` con `multiple`.
 * Permite seleccionar varias opciones (se muestran como chips) y tipear para filtrar.
 * Usado para campos con relación muchos-a-muchos (ej. categorías de gastos/sub-items).
 */

export type AppMultiSelectValue = string | number

export interface AppMultiSelectOption {
  value: AppMultiSelectValue
  label: string
}

interface AppMultiSelectProps {
  label: string
  options: AppMultiSelectOption[]
  value: AppMultiSelectValue[]
  onChange: (value: AppMultiSelectValue[]) => void
  size?: 'small' | 'medium'
  fullWidth?: boolean
  sx?: any
  placeholder?: string
}

export default function AppMultiSelect({
  label,
  options,
  value,
  onChange,
  size = 'small',
  fullWidth,
  sx,
  placeholder,
}: AppMultiSelectProps) {
  const selected = useMemo(
    () => options.filter(o => value.includes(o.value)),
    [options, value],
  )

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      options={options}
      value={selected}
      onChange={(_, newValue) => onChange(newValue.map(o => o.value))}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, val) => option.value === val.value}
      renderTags={(tags, getTagProps) =>
        tags.map((option, index) => {
          const { key, ...rest } = getTagProps({ index }) as any
          return <Chip key={option.value} size="small" label={option.label} {...rest} />
        })
      }
      size={size}
      fullWidth={fullWidth}
      sx={sx}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          size={size}
          placeholder={selected.length === 0 ? placeholder : undefined}
        />
      )}
    />
  )
}
