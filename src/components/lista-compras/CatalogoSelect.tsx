'use client'

import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import TextField from '@/components/shared/AppTextField'
import type { OpcionCatalogo } from './useListaCompras'

/** Opción sintética "Agregar «x»": no existe en la tabla hasta que se la elige. */
type Opcion = OpcionCatalogo & { _nueva?: string }

const filter = createFilterOptions<Opcion>()

interface Props {
  label: string
  options: OpcionCatalogo[]
  /** Id elegido, o `null` sin selección. */
  value: number | null
  onChange: (id: number | null) => void
  /** Crea la opción en la tabla y la devuelve (o `null` si falló). */
  onCrear: (nombre: string) => Promise<OpcionCatalogo | null>
  /** Permite dejar el campo sin valor (rubro sí, unidad no). */
  clearable?: boolean
  /** Número (px), string o valores por breakpoint: `{ xs: '100%', sm: 150 }`. */
  width?: number | string | Record<string, number | string>
  disabled?: boolean
  /** Ocupa todo el ancho disponible (en un contenedor flex, `flex: 1`). */
  fullWidth?: boolean
  /** Campo de 56px en vez de 40px: más cómodo de tocar en el celular. */
  medium?: boolean
}

/**
 * Select de una tabla de catálogo (unidades, rubros): se elige de las existentes y, si lo
 * tipeado no existe, aparece "Agregar «…»" que lo crea y lo selecciona. No admite texto
 * libre: lo que queda seleccionado siempre es una fila de la tabla.
 */
export default function CatalogoSelect({ label, options, value, onChange, onCrear, clearable = false, width = 160, disabled, fullWidth, medium }: Props) {
  const seleccionada = options.find((o) => o.id === value) ?? null

  return (
    <Autocomplete<Opcion, false, boolean, false>
      size={medium ? 'medium' : 'small'}
      options={options}
      value={seleccionada}
      disableClearable={!clearable as any}
      disabled={disabled}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      getOptionLabel={(o) => (o._nueva ? o._nueva : o.nombre)}
      filterOptions={(opts, params) => {
        const filtradas = filter(opts, params)
        const escrito = params.inputValue.trim()
        const existe = opts.some((o) => o.nombre.toLowerCase() === escrito.toLowerCase())
        if (escrito && !existe) filtradas.push({ id: -1, nombre: `Agregar «${escrito}»`, _nueva: escrito })
        return filtradas
      }}
      onChange={async (_, v) => {
        if (!v) return onChange(null)
        if (v._nueva) {
          const creada = await onCrear(v._nueva)
          if (creada) onChange(creada.id)
          return
        }
        onChange(v.id)
      }}
      renderOption={(props, o) => (
        <li {...props} key={o.id}>
          {o._nueva ? <em>{o.nombre}</em> : o.nombre}
        </li>
      )}
      noOptionsText="Escribí para agregar"
      renderInput={(params) => <TextField {...params} label={label} />}
      sx={fullWidth ? { flex: 1, minWidth: 0 } : { width }}
    />
  )
}
