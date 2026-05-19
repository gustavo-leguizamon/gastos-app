'use client'

import { forwardRef } from 'react'
import TextField, { TextFieldProps } from '@mui/material/TextField'

/**
 * Wrapper de MUI `TextField` para inputs de fecha. Setea `type="date"` y
 * `InputLabelProps.shrink` por defecto, y abre el calendario nativo al recibir foco
 * (vía `HTMLInputElement.showPicker()`). Permite tipear la fecha manualmente.
 */
const AppDateField = forwardRef<HTMLDivElement, TextFieldProps>(function AppDateField(props, ref) {
  const { InputLabelProps, onFocus, ...rest } = props
  return (
    <TextField
      {...rest}
      ref={ref}
      type="date"
      InputLabelProps={{ shrink: true, ...(InputLabelProps ?? {}) }}
      onFocus={(e) => {
        const input = e.currentTarget.querySelector('input') as HTMLInputElement | null
        try { (input as any)?.showPicker?.() } catch { /* picker unsupported or blocked */ }
        onFocus?.(e)
      }}
    />
  )
})

export default AppDateField
