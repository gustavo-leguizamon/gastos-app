'use client'

import Switch, { SwitchProps } from '@mui/material/Switch'
import FormControlLabel, { FormControlLabelProps } from '@mui/material/FormControlLabel'

/**
 * Toggle estándar de la app — `FormControlLabel` + `Switch`.
 * Reemplaza a `Checkbox` en toda la app para mantener consistencia visual.
 *
 * Para toggles sin label (ej. iconos inline en una grilla), usar `<Switch />` de MUI directamente.
 */
type AppToggleProps = SwitchProps & {
  label: React.ReactNode
  labelPlacement?: FormControlLabelProps['labelPlacement']
}

export default function AppToggle({ label, labelPlacement, ...switchProps }: AppToggleProps) {
  return (
    <FormControlLabel
      control={<Switch {...switchProps} />}
      label={label}
      labelPlacement={labelPlacement}
    />
  )
}
