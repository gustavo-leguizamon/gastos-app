'use client'

import { forwardRef, useState, type ChangeEvent } from 'react'
import { TextFieldProps } from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import AppTextField from './AppTextField'
import { invertirSigno, aplicarNegativo, esNegativo } from '@/lib/signo-monto'

/**
 * Campo de monto que admite negativos, con un botón ± al inicio.
 *
 * En el celular el teclado numérico de `type="number"` muchas veces no trae la tecla "-": el botón
 * invierte el signo del valor cargado. Si el campo está vacío o en 0, el signo queda **pendiente**
 * (el ± se marca en rojo) y se aplica al primer número que se tipee.
 *
 * El ± emite un `onChange` con forma de evento (`{ target: { value } }`), así sirve tanto con
 * `field.onChange` de react-hook-form como con un `setX(e.target.value)`.
 */
type Props = TextFieldProps & { autoSelectOnFocus?: boolean }

function emitir(onChange: Props['onChange'], value: string) {
  onChange?.({ target: { value } } as ChangeEvent<HTMLInputElement>)
}

type Valor = string | number | null | undefined

const AppMontoField = forwardRef<HTMLDivElement, Props>(function AppMontoField(
  { onChange, value, InputProps, inputProps, disabled, ...rest },
  ref,
) {
  const [negativoPendiente, setNegativoPendiente] = useState(false)
  const negativo = negativoPendiente || esNegativo(value as Valor)

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (negativoPendiente) {
      const tipeado = e.target.value
      const conSigno = aplicarNegativo(tipeado)
      // El pendiente se consume en cuanto hay un número con magnitud (o el usuario tipeó el "-").
      if (conSigno.startsWith('-')) setNegativoPendiente(false)
      if (conSigno !== tipeado) return emitir(onChange, conSigno)
    }
    onChange?.(e)
  }

  const handleSigno = () => {
    const invertido = invertirSigno(value as Valor)
    if (invertido == null) {
      setNegativoPendiente(p => !p)
      return
    }
    setNegativoPendiente(false)
    emitir(onChange, invertido)
  }

  return (
    <AppTextField
      {...rest}
      ref={ref}
      type="number"
      value={value}
      disabled={disabled}
      onChange={handleChange}
      inputProps={{ step: 0.01, ...inputProps }}
      InputProps={{
        ...InputProps,
        startAdornment: (
          <InputAdornment position="start" sx={{ mr: 0.5 }}>
            <Tooltip title="Cambiar signo">
              <span>
                <IconButton
                  size="small"
                  edge="start"
                  aria-label="Cambiar signo"
                  aria-pressed={negativo}
                  disabled={disabled}
                  // Sin esto, tocar el botón le saca el foco al input y en el celular se cierra el teclado.
                  onMouseDown={e => e.preventDefault()}
                  onClick={handleSigno}
                  sx={{
                    width: 28, height: 28, fontSize: 18, fontWeight: 700, lineHeight: 1,
                    color: negativo ? 'error.main' : 'text.secondary',
                    bgcolor: negativoPendiente ? 'action.selected' : undefined,
                  }}
                >
                  ±
                </IconButton>
              </span>
            </Tooltip>
          </InputAdornment>
        ),
      }}
    />
  )
})

export default AppMontoField
