'use client'

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import IconButton from '@mui/material/IconButton'
import AppSelect from '@/components/shared/AppSelect'
import type { Categoria, Etiqueta } from '@/lib/types'

interface Props {
  count: number
  totalFiltrados: number
  allSelected: boolean
  onToggleAll: (checked: boolean) => void
  onApplyCategoria: (categoriaId: number, action: 'add' | 'remove') => Promise<void>
  onApplyEtiqueta: (etiquetaId: number, action: 'add' | 'remove') => Promise<void>
  onDelete: () => void
  onCancel: () => void
}

/**
 * Barra contextual de acciones masivas sobre los gastos seleccionados.
 * Se muestra al activar el modo selección en `GastosTable`. Permite:
 *  - asignar/quitar la **categoría única** (partición) de todos los seleccionados;
 *  - agregar/quitar una **etiqueta** (corte transversal M2M) de todos los seleccionados;
 *  - **eliminar** todos los seleccionados (con confirmación en `GastosTable`).
 */
export default function BulkAccionesBar({
  count,
  totalFiltrados,
  allSelected,
  onToggleAll,
  onApplyCategoria,
  onApplyEtiqueta,
  onDelete,
  onCancel,
}: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [categoriaId, setCategoriaId] = useState<number | null>(null)
  const [etiquetaId, setEtiquetaId] = useState<number | null>(null)
  const [aplicando, setAplicando] = useState(false)

  useEffect(() => {
    fetch('/api/categorias').then(r => r.json()).then(setCategorias).catch(() => {})
    fetch('/api/etiquetas').then(r => r.json()).then(setEtiquetas).catch(() => {})
  }, [])

  const run = async (fn: () => Promise<void>) => {
    setAplicando(true)
    try {
      await fn()
    } finally {
      setAplicando(false)
    }
  }

  const catDisabled = aplicando || count === 0 || categoriaId == null
  const etDisabled = aplicando || count === 0 || etiquetaId == null

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
        flexDirection: 'column',
        gap: 1.25,
      }}
    >
      {/* Fila 1: selección */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
        <IconButton size="small" onClick={onCancel} aria-label="Cerrar selección" sx={{ ml: 'auto' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Divider />

      {/* Fila 2: categoría única */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
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
        <Button variant="contained" size="small" startIcon={<AddIcon />} disabled={catDisabled} onClick={() => run(() => onApplyCategoria(categoriaId!, 'add'))}>
          Asignar
        </Button>
        <Button variant="outlined" size="small" color="warning" startIcon={<RemoveIcon />} disabled={catDisabled} onClick={() => run(() => onApplyCategoria(categoriaId!, 'remove'))}>
          Quitar categoría
        </Button>
      </Box>

      {/* Fila 3: etiquetas (M2M) */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Box sx={{ minWidth: { xs: '100%', sm: 220 }, flex: { sm: '0 1 260px' } }}>
          <AppSelect
            label="Etiqueta"
            fullWidth
            options={etiquetas.map(e => ({ value: e.id, label: e.nombre }))}
            value={etiquetaId}
            onChange={(v) => setEtiquetaId(v as number | null)}
            placeholder="Elegí una etiqueta"
          />
        </Box>
        <Button variant="contained" size="small" startIcon={<AddIcon />} disabled={etDisabled} onClick={() => run(() => onApplyEtiqueta(etiquetaId!, 'add'))}>
          Agregar etiqueta
        </Button>
        <Button variant="outlined" size="small" color="warning" startIcon={<RemoveIcon />} disabled={etDisabled} onClick={() => run(() => onApplyEtiqueta(etiquetaId!, 'remove'))}>
          Quitar etiqueta
        </Button>
      </Box>

      <Divider />

      {/* Fila 4: borrado masivo */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Button
          variant="outlined"
          size="small"
          color="error"
          startIcon={<DeleteIcon />}
          disabled={aplicando || count === 0}
          onClick={onDelete}
        >
          Eliminar seleccionados
        </Button>
      </Box>
    </Paper>
  )
}
