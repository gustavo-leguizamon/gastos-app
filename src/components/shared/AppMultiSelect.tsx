'use client'

import { useEffect, useMemo, useState } from 'react'
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'

/**
 * Multi-select estándar de la app — wrapper de MUI `Autocomplete` con `multiple`.
 * Permite seleccionar varias opciones (se muestran como chips) y tipear para filtrar.
 * Usado para campos con relación muchos-a-muchos (ej. etiquetas de gastos/sub-items).
 *
 * Si se pasa `onCreate`, habilita crear una opción nueva tipeando (aparece "Agregar «X»").
 * Si se pasa `destacadas`, el listado arranca recortado a ese subconjunto (ver la prop).
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
  /** Fila sintética al pie del listado que levanta el recorte de `destacadas`. */
  __expand?: boolean
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
  /**
   * Subconjunto a mostrar mientras el usuario no tipea nada: se ven sólo estas opciones (más
   * las ya seleccionadas) y una fila "Ver todas (N)" al pie. `null`/`undefined` = sin recorte.
   *
   * El recorte es deliberadamente blando: al tipear se busca sobre **todas** las opciones. Si
   * la búsqueda respetara el recorte, una opción existente pero oculta no aparecería y —con
   * `onCreate`— se le ofrecería "Agregar «X»", creando un duplicado del mismo nombre. Esconder
   * de más acá cuesta datos sucios, no un click.
   */
  destacadas?: AppMultiSelectValue[] | null
  /** Texto de ayuda debajo del campo, igual que en `AppSelect`. */
  helperText?: string
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
  destacadas,
  helperText,
}: AppMultiSelectProps) {
  const [verTodas, setVerTodas] = useState(false)

  // Las seleccionadas se resuelven contra `options` completo, nunca contra el recorte: un chip
  // ya elegido tiene que seguir renderizando aunque su opción esté oculta del listado.
  const selected = useMemo(
    () => options.filter(o => value.includes(o.value)),
    [options, value],
  )

  // Cambió el criterio (ej. otra categoría en el gasto) → volver a recortar. Se depende de los
  // ids serializados y no del array: el padre suele armarlo inline y cambiaría de identidad en
  // cada render, pisando el "Ver todas" que el usuario acababa de tocar.
  const claveDestacadas = destacadas?.join(',')
  useEffect(() => { setVerTodas(false) }, [claveDestacadas])

  // Las seleccionadas entran siempre al recorte, si no desaparecerían del listado al reabrirlo.
  const recorte = useMemo(
    () => (destacadas && !verTodas ? new Set<AppMultiSelectValue>([...destacadas, ...value]) : null),
    [destacadas, verTodas, value],
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
          } else if ((v as CreatableOption).__expand) {
            // No es un valor: es el "Ver todas". Levanta el recorte sin seleccionar nada.
            setVerTodas(true)
          } else if ((v as CreatableOption).__create) {
            const created = onCreate ? await onCreate((v as CreatableOption).inputValue ?? '') : null
            if (created) out.push(created.value)
          } else {
            out.push((v as CreatableOption).value)
          }
        }
        onChange(out)
      }}
      filterOptions={(onCreate || recorte) ? (opts, params) => {
        const q = params.inputValue.trim()
        // Con texto tipeado se busca sobre todas: el recorte sólo aplica al listado en frío.
        const base = (recorte && q === '') ? opts.filter(o => recorte.has(o.value)) : opts
        const filtered = filter(base, params)
        if (onCreate && q !== '' && !opts.some(o => o.label.toLowerCase() === q.toLowerCase())) {
          filtered.push({ value: `__create__${q}`, label: `Agregar "${q}"`, inputValue: q, __create: true })
        }
        if (recorte && q === '' && filtered.length < opts.length) {
          filtered.push({ value: '__expand__', label: `Ver todas (${opts.length})`, __expand: true })
        }
        return filtered
      } : undefined}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
      isOptionEqualToValue={(option, val) => typeof option !== 'string' && typeof val !== 'string' && option.value === val.value}
      renderOption={(props, option) => {
        const { key, ...rest } = props as any
        const o = option as CreatableOption
        if (o.__expand) {
          return (
            <li key="__expand__" {...rest}>
              <Typography variant="body2" color="primary">{o.label}</Typography>
            </li>
          )
        }
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
          helperText={helperText}
        />
      )}
    />
  )
}
