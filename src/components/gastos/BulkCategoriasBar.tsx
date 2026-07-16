'use client'

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import CloseIcon from '@mui/icons-material/Close'
import IconButton from '@mui/material/IconButton'
import AppSelect from '@/components/shared/AppSelect'
import type { Categoria } from '@/lib/types'

interface Props {
  count: number
  totalFiltrados: number
  allSelected: boolean
  onToggleAll: (checked: boolean) => void
  onApply: (categoriaId: number, action: 'add' | 'remove') => Promise<void>
  onCancel: () => void
}

/**
 * Barra contextual de acciones masivas sobre las categorías de los gastos seleccionados.
 * Se muestra al activar el modo selección en `GastosTable`. Permite elegir una categoría y
 * agregarla o quitarla de todos los gastos seleccionados a la vez.
 */
export default function BulkCategoriasBar({ count, totalFiltrados, allSelected, onToggleAll, onApply, onCancel }: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaId, setCategoriaId] = useState<number | null>(null)
  const [aplicando, setAplicando] = useState(false)

  useEffect(() => {
    fetch('/api/categorias')
      .then(r => r.json())
      .then(setCategorias)
      .catch(() => {})
  }, [])

  const apply = async (action: 'add' | 'remove') => {
    if (categoriaId == null || count === 0) return
    setAplicando(true)
    try {
      await onApply(categoriaId, action)
    } finally {
      setAplicando(false)
    }
  }

  const disabled = aplicando || count === 0 || categoriaId == null

  return (
    <Paper
      variant="outlined"
      sx={{
        position: 'sticky',
        top: 8,
        zIndex: 5,
        p: 1.5,
        mb: 2,
        borderColor: 'primary.main',
        bgcolor: 'background.paper',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 'auto' }}>
        <FormControlLabel
          sx={{ mr: 0 }}
          control={
            <Checkbox
              size="small"
              checked={allSelected}
              indeterminate={count > 0 && !allSelected}
              onChange={(e) => onToggleAll(e.target.checked)}
            />
          }
          label={<Typography variant="body2">Todos</Typography>}
        />
        <Typography variant="body2" fontWeight={600} color="primary.main">
          {count} de {totalFiltrados} seleccionado{count !== 1 ? 's' : ''}
        </Typography>
      </Box>

      <Box sx={{ minWidth: { xs: '100%', sm: 220 }, flex: { sm: '0 1 260px' } }}>
        <AppSelect
          label="Categoría"
          fullWidth
          options={categorias.map(c => ({ value: c.id, label: c.nombre }))}
          value={categoriaId}
          onChange={(v) => setCategoriaId(v as number | null)}
          placeholder="Elegí una categoría"
        />
      </Box>

      <Button
        variant="contained"
        size="small"
        startIcon={<AddIcon />}
        disabled={disabled}
        onClick={() => apply('add')}
      >
        Asignar
      </Button>
      <Button
        variant="outlined"
        size="small"
        color="warning"
        startIcon={<RemoveIcon />}
        disabled={disabled}
        onClick={() => apply('remove')}
      >
        Quitar categoría
      </Button>

      <IconButton size="small" onClick={onCancel} aria-label="Cerrar selección">
        <CloseIcon fontSize="small" />
      </IconButton>
    </Paper>
  )
}
