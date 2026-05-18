'use client'

import { forwardRef } from 'react'
import TextField, { TextFieldProps } from '@mui/material/TextField'

/**
 * Wrapper de MUI `TextField` que auto-selecciona el contenido del input al recibir foco.
 * Comportamiento por defecto en toda la app — si en algún caso puntual no se desea,
 * pasar `autoSelectOnFocus={false}` o un `onFocus` propio que no llame a `e.target.select()`.
 */
type Props = TextFieldProps & { autoSelectOnFocus?: boolean }

const AppTextField = forwardRef<HTMLDivElement, Props>(function AppTextField(
  { autoSelectOnFocus = true, onFocus, ...rest },
  ref,
) {
  return (
    <TextField
      {...rest}
      ref={ref}
      onFocus={(e) => {
        if (autoSelectOnFocus) {
          const input = e.target as HTMLInputElement
          if (input && typeof input.select === 'function') {
            // setTimeout para que el select gane sobre el cursor que pone el navegador al hacer foco
            setTimeout(() => input.select(), 0)
          }
        }
        onFocus?.(e)
      }}
    />
  )
})

export default AppTextField
