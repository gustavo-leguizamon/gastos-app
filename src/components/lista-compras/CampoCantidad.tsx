'use client'

import { useRef } from 'react'
import InputAdornment from '@mui/material/InputAdornment'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import TextField from '@/components/shared/AppTextField'
import { textoAlCambiarUnidad, type SubunidadDe } from '@/lib/lista-compras-compute'

interface Props {
  label: string
  value: string
  onChange: (v: string) => void
  /** true = lo tipeado está en kg/l (se registra ×1000). */
  multiplo: boolean
  onMultiplo: (m: boolean) => void
  /** Unidad del artículo (g, ml, un…): es en la que se registra. */
  unidad: string
  /** "kg"/"l" si la unidad es g/ml; sin él no hay nada que elegir. */
  base: SubunidadDe | null
  /** Cantidad de referencia en la unidad del artículo (lo guardado o precargado), para convertirla al cambiar de unidad. */
  referencia?: number | null
  /**
   * Edición en línea: guardar lo tipeado con la unidad elegida. Se llama al salir del campo (no si
   * el foco va al selector de unidad del mismo campo) y al cambiar la unidad, que puede cambiar
   * lo que significa el número tipeado. Los formularios con botón de guardar no lo usan.
   */
  onCommit?: (texto: string, multiplo: boolean) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  disabled?: boolean
  autoFocus?: boolean
  helperText?: string
  error?: boolean
  size?: 'small' | 'medium'
  sx?: object
  inputStyle?: React.CSSProperties
}

/**
 * Cantidad con la unidad en que se está cargando. En artículos en g/ml se elige g o kg (ml o l) a
 * la derecha del campo; quien lo usa registra siempre en la unidad del artículo con
 * `aCantidadBase(valor, multiplo)`. Al cambiar de unidad, lo que todavía es la referencia se
 * convierte (2500 g ↔ 2,5 kg) y un número ya tipeado se conserva (`textoAlCambiarUnidad`).
 */
export default function CampoCantidad({
  label, value, onChange, multiplo, onMultiplo, unidad, base, referencia = null,
  onCommit, onKeyDown, disabled, autoFocus, helperText, error, size = 'small', sx, inputStyle,
}: Props) {
  // Abrir el selector y cerrarlo sin cambiar la unidad no debe dejar lo tipeado sin guardar.
  const eligio = useRef(false)
  const alCerrarSelector = () => {
    if (!eligio.current) onCommit?.(value, multiplo)
    eligio.current = false
  }
  const cambiar = (nuevo: boolean) => {
    eligio.current = true
    const texto = textoAlCambiarUnidad(value, multiplo, nuevo, referencia)
    onChange(texto)
    onMultiplo(nuevo)
    onCommit?.(texto, nuevo)
  }
  const alSalir = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // El foco pasa al selector de unidad de este mismo campo: se guarda cuando se elija la unidad.
    const destino = e.relatedTarget as Node | null
    if (destino && e.currentTarget.closest('.MuiInputBase-root')?.contains(destino)) return
    onCommit?.(value, multiplo)
  }
  return (
    <TextField
      size={size}
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={alSalir}
      onKeyDown={onKeyDown}
      disabled={disabled}
      autoFocus={autoFocus}
      helperText={helperText}
      error={error}
      inputProps={{ inputMode: 'decimal', style: inputStyle }}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end" sx={{ ml: 0.5 }}>
            {base ? (
              <Select
                variant="standard"
                disableUnderline
                value={multiplo ? 'multiplo' : 'base'}
                onChange={(e) => cambiar(e.target.value === 'multiplo')}
                onClose={alCerrarSelector}
                disabled={disabled}
                inputProps={{ 'aria-label': `Unidad de ${label}` }}
                sx={{ fontSize: '0.875rem', '& .MuiSelect-select': { py: 0, pr: '20px !important' } }}
              >
                <MenuItem value="base">{unidad}</MenuItem>
                <MenuItem value="multiplo">{base}</MenuItem>
              </Select>
            ) : (
              unidad
            )}
          </InputAdornment>
        ),
      }}
      sx={sx}
    />
  )
}
