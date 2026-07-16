'use client'

import { useMemo } from 'react'
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'

/**
 * Multi-select estándar de la app — wrapper de MUI `Autocomplete` con `multiple`.
 * Permite seleccionar varias opciones (se muestran como chips) y tipear para filtrar.
 * Usado para campos con relación muchos-a-muchos (ej. etiquetas de gastos/sub-items).
 *
 * Si se pasa `onCreate`, habilita crear una opción nueva tipeando (aparece "Agregar «X»").
 */

export type AppMultiSelectValue = string | number

export interface AppMultiSelectOption {
  value: AppMultiSelectValue
  label: string
  /** Render opcional para mostrar contenido rico (íconos, logos) dentro del item del dropdown. */
  render?: () => React.ReactNode
}

interface CreatableOption extends AppMultiSelectOption {
  inputValue?: string
  __create?: boolean
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
  /** Si se provee, permite crear una opción nueva tipeando: debe persistirla y devolver la opción creada (o null si falla). */
  onCreate?: (nombre: string) => Promise<AppMultiSelectOption | null>
}

const filter = createFilterOptions<CreatableOption>()

export default function AppMultiSelect({
  label,
  options,
  value,
  onChange,
  size = 'small',
  fullWidth,
  sx,
  placeholder,
  onCreate,
}: AppMultiSelectProps) {
  const selected = useMemo(
    () => options.filter(o => value.includes(o.value)),
    [options, value],
  )

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      freeSolo={!!onCreate}
      selectOnFocus={!!onCreate}
      clearOnBlur={!!onCreate}
      handleHomeEndKeys
      options={options as CreatableOption[]}
      value={selected as CreatableOption[]}
      onChange={async (_, newValue) => {
        const out: AppMultiSelectValue[] = []
        for (const v of newValue) {
          if (typeof v === 'string') {
            // Texto libre + Enter → crear.
            if (onCreate && v.trim()) {
              const created = await onCreate(v.trim())
              if (created) out.push(created.value)
            }
          } else if ((v as CreatableOption).__create) {
            const created = onCreate ? await onCreate((v as CreatableOption).inputValue ?? '') : null
            if (created) out.push(created.value)
          } else {
            out.push((v as CreatableOption).value)
          }
        }
        onChange(out)
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
      renderTags={(tags, getTagProps) =>
        tags.map((option, index) => {
          const o = option as CreatableOption
          const { key, ...rest } = getTagProps({ index }) as any
          return <Chip key={String(o.value)} size="small" label={o.label} {...rest} />
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
