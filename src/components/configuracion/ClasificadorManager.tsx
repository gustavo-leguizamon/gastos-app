'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import MergeIcon from '@mui/icons-material/CallMerge'
import toast from 'react-hot-toast'
import AppTextField from '@/components/shared/AppTextField'
import AppSelect from '@/components/shared/AppSelect'
import type { Categoria, Etiqueta } from '@/lib/types'

/** Categoría y etiqueta tienen la misma forma; el ABM es idéntico salvo el copy. */
type Clasificador = Categoria | Etiqueta

interface Props {
  /** Base del endpoint, sin barra final: `/api/categorias` o `/api/etiquetas`. */
  endpoint: string
  items: Clasificador[]
  /** Recarga la lista desde el padre (que es quien la tiene en estado). */
  onReload: () => Promise<void> | void
  /** Nombre en singular, para los mensajes: "categoría" / "etiqueta". */
  singular: string
  /** `la` / `las` — el artículo que acompaña al singular en los textos. */
  articulo: 'la' | 'el'
  placeholder: string
  /** Pide confirmación antes de borrar (lo provee la página, que tiene el ConfirmDialog). */
  onAskDelete: (nombre: string, run: () => void) => void
}

/**
 * ABM de un eje de clasificación (categorías o etiquetas): alta, renombrar inline, fusionar
 * y borrar-si-no-está-en-uso.
 *
 * Existe porque los dos bloques eran copias literales en `configuracion/page.tsx` (~120
 * líneas duplicadas): al sumar el fusionado habría que haber escrito el mismo diálogo dos
 * veces, y cualquier arreglo posterior se aplicaría a una sola de las dos mitades.
 * Mismas capacidades que `ConceptosManager`, que ya tenía este ABM completo.
 */
export default function ClasificadorManager({
  endpoint, items, onReload, singular, articulo, placeholder, onAskDelete,
}: Props) {
  const [nuevo, setNuevo] = useState('')
  const [editando, setEditando] = useState<{ id: number; nombre: string } | null>(null)
  const [mergeSource, setMergeSource] = useState<Clasificador | null>(null)
  const [mergeTarget, setMergeTarget] = useState<number | null>(null)

  const handleAdd = async () => {
    const nombre = nuevo.trim()
    if (!nombre) return
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data.error ?? 'Error al crear'); return }
    // El backend hace find-or-create: si ya existía una equivalente devuelve esa, y conviene
    // decirlo para que no parezca que el alta no hizo nada.
    if (data?.nombre && data.nombre.toLowerCase() !== nombre.toLowerCase()) {
      toast.success(`Ya existía como "${data.nombre}"`)
    }
    setNuevo('')
    await onReload()
  }

  const handleSave = async () => {
    if (!editando) return
    const res = await fetch(`${endpoint}/${editando.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: editando.nombre }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data.error ?? 'Error al guardar'); return }
    setEditando(null)
    await onReload()
  }

  const handleRemove = async (id: number) => {
    const res = await fetch(`${endpoint}/${id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data.error ?? 'Error al borrar'); return }
    await onReload()
  }

  const handleMerge = async () => {
    if (!mergeSource || !mergeTarget) return
    const res = await fetch(`${endpoint}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: mergeSource.id, target_id: mergeTarget }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data.error ?? 'Error al fusionar'); return }
    toast.success(`Fusionado (${data.moved_gastos} gastos, ${data.moved_items} sub-items)`)
    setMergeSource(null); setMergeTarget(null)
    await onReload()
  }

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <AppTextField
          size="small" fullWidth
          label={placeholder}
          value={nuevo}
          onChange={e => setNuevo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <IconButton onClick={handleAdd} color="primary"><AddIcon /></IconButton>
      </Box>
      <Divider sx={{ mb: 1 }} />
      <List dense disablePadding sx={{ maxHeight: 320, overflowY: 'auto' }}>
        {items.map(l => (
          <ListItem key={l.id} disablePadding sx={{ py: 0.5 }}
            secondaryAction={
              editando?.id === l.id ? (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton size="small" color="primary" onClick={handleSave}><CheckIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => setEditando(null)}><CloseIcon fontSize="small" /></IconButton>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  <Chip size="small" label={`${l.uso ?? 0} uso${l.uso === 1 ? '' : 's'}`} variant="outlined" sx={{ mr: 0.5 }} />
                  <IconButton size="small" onClick={() => setEditando({ id: l.id, nombre: l.nombre })}><EditIcon fontSize="small" /></IconButton>
                  <Tooltip title={`Fusionar en otra ${singular}`}>
                    <IconButton size="small" onClick={() => { setMergeSource(l); setMergeTarget(null) }}><MergeIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title={(l.uso ?? 0) > 0 ? 'En uso: fusionala en vez de borrar' : 'Borrar'}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={(l.uso ?? 0) > 0}
                        onClick={() => onAskDelete(l.nombre, () => handleRemove(l.id))}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              )
            }
          >
            {editando?.id === l.id ? (
              <AppTextField
                size="small" fullWidth autoFocus
                value={editando.nombre}
                onChange={e => setEditando(p => p ? { ...p, nombre: e.target.value } : p)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditando(null) }}
                sx={{ mr: 9 }}
              />
            ) : (
              <ListItemText primary={l.nombre} sx={{ pr: 20 }} />
            )}
          </ListItem>
        ))}
      </List>

      <Dialog open={!!mergeSource} onClose={() => setMergeSource(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Fusionar {singular}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Todos los gastos y sub-items de <strong>{mergeSource?.nombre}</strong> pasan
            a {articulo} {singular} destino, y <strong>{mergeSource?.nombre}</strong> se elimina.
          </Typography>
          <AppSelect
            label="Destino"
            options={items.filter(c => c.id !== mergeSource?.id).map(c => ({ value: c.id, label: c.nombre }))}
            value={mergeTarget}
            onChange={(v) => setMergeTarget(v == null ? null : Number(v))}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMergeSource(null)}>Cancelar</Button>
          <Button variant="contained" color="warning" startIcon={<MergeIcon />} disabled={!mergeTarget} onClick={handleMerge}>
            Fusionar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
