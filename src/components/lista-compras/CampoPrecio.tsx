'use client'

import Box from '@mui/material/Box'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import TextField from '@/components/shared/AppTextField'
import { aPrecioBase, precioUnitarioDeEntrada, type ModoPrecio, type SubunidadDe } from '@/lib/lista-compras-compute'
import { fmtARS, parseNum } from './formato'

interface Props {
  modo: ModoPrecio
  onModo: (m: ModoPrecio) => void
  value: string
  onChange: (v: string) => void
  /** "kg"/"l" si la unidad es g/ml: el precio unitario se tipea por kg/litro. */
  base: SubunidadDe | null
  /** Nombre de la unidad de la línea (g, ml, un…), para los textos. */
  unidad: string
  /** Cantidad ya tipeada: hace falta para pasar de "total pagado" a precio unitario. */
  cantidad: number | null
  opcional?: boolean
  size?: 'small' | 'medium'
  sx?: object
}

/**
 * Precio de una compra, tipeable de dos formas: **precio unitario** (por kg/litro si la unidad es
 * g/ml) o **total pagado** (lo que salió esa cantidad, de donde se calcula el unitario). Debajo
 * muestra en vivo el resultado: "= $4.000 por kg · $4 por g". Quien lo usa convierte lo tipeado
 * con `precioUnitarioDeEntrada` antes de guardar (se guarda siempre por la unidad de la línea).
 */
export default function CampoPrecio({ modo, onModo, value, onChange, base, unidad, cantidad, opcional, size = 'small', sx }: Props) {
  const v = parseNum(value)
  const unitario = v != null && Number.isFinite(v) && v >= 0 ? precioUnitarioDeEntrada(modo, v, cantidad, base) : null

  let ayuda: string
  if (unitario != null) {
    ayuda = base
      ? `= ${fmtARS(aPrecioBase(unitario, base))} por ${base} · ${fmtARS(unitario)} por ${unidad}`
      : `= ${fmtARS(unitario)} por ${unidad}`
  } else if (modo === 'total' && v != null && (cantidad == null || cantidad <= 0)) {
    ayuda = 'Indicá la cantidad para calcular el precio unitario'
  } else {
    ayuda = modo === 'total' ? 'Lo que pagaste por esa cantidad' : ''
  }

  const etiqueta = modo === 'total' ? 'Total pagado' : base ? `Precio por ${base}` : 'Precio unitario'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ...sx }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        fullWidth
        value={modo}
        onChange={(_, m: ModoPrecio | null) => { if (m) onModo(m) }}
        aria-label="Cómo cargar el precio"
      >
        <ToggleButton value="unitario">{base ? `Por ${base}` : 'Unitario'}</ToggleButton>
        <ToggleButton value="total">Total pagado</ToggleButton>
      </ToggleButtonGroup>
      <TextField
        size={size}
        label={`${etiqueta}${opcional ? ' (opcional)' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputProps={{ inputMode: 'decimal' }}
        helperText={ayuda || undefined}
      />
    </Box>
  )
}
