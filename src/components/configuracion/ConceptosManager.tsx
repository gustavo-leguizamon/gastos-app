'use client'

import { useEffect, useState, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@/components/shared/AppTextField'
import AppSelect from '@/components/shared/AppSelect'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import MergeIcon from '@mui/icons-material/CallMerge'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import type { Concepto } from '@/lib/types'

export default function ConceptosManager() {
  const [conceptos, setConceptos] = useState<Concepto[]>([])
  const [filtro, setFiltro] = useState('')
  const [nuevo, setNuevo] = useState('')
  const [editing, setEditing] = useState<{ id: number; nombre: string } | null>(null)
  const [mergeSource, setMergeSource] = useState<Concepto | null>(null)
  const [mergeTarget, setMergeTarget] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Concepto | null>(null)

  const load = () => fetch('/api/conceptos').then(r => r.json()).then(setConceptos)
  useEffect(() => { load() }, [])

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    return q ? conceptos.filter(c => c.nombre.toLowerCase().includes(q)) : conceptos
  }, [conceptos, filtro])

  const handleAdd = async () => {
    if (!nuevo.trim()) return
    const res = await fetch('/api/conceptos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nuevo.trim() }),
    })
    if (!res.ok) { toast.error('Error al agregar concepto'); return }
    setNuevo(''); await load(); toast.success('Concepto agregado')
  }

  const handleRename = async () => {
    if (!editing || !editing.nombre.trim()) return
    const res = await fetch(`/api/conceptos/${editing.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: editing.nombre.trim() }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data.error ?? 'Error al renombrar'); return }
    setEditing(null); await load(); toast.success('Concepto renombrado')
  }

  const handleDelete = async (c: Concepto) => {
    const res = await fetch(`/api/conceptos/${c.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data.error ?? 'Error al borrar'); return }
    await load(); toast.success('Concepto borrado')
  }

  const handleMerge = async () => {
    if (!mergeSource || !mergeTarget) return
    const res = await fetch('/api/conceptos/merge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: mergeSource.id, target_id: mergeTarget }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data.error ?? 'Error al fusionar'); return }
    toast.success(`Fusionado (${data.moved_gastos} gastos, ${data.moved_items} sub-items)`)
    setMergeSource(null); setMergeTarget(null); await load()
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Los conceptos son el "qué" canónico de cada gasto/sub-item (Netflix, Luz…). Renombrar uno
        se refleja en todo el histórico; fusionar limpia duplicados ("Netflix" + "netflix").
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small" fullWidth label="Nuevo concepto"
          value={nuevo} onChange={e => setNuevo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <IconButton onClick={handleAdd} color="primary"><AddIcon /></IconButton>
      </Box>

      <TextField
        size="small" fullWidth placeholder="Buscar concepto…"
        value={filtro} onChange={e => setFiltro(e.target.value)} sx={{ mb: 1 }}
      />
      <Divider sx={{ mb: 1 }} />

      <List dense disablePadding sx={{ maxHeight: 420, overflowY: 'auto' }}>
        {visibles.map(c => (
          <ListItem key={c.id} disablePadding sx={{ py: 0.5 }}
            secondaryAction={
              editing?.id === c.id ? (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton size="small" color="primary" onClick={handleRename}><CheckIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => setEditing(null)}><CloseIcon fontSize="small" /></IconButton>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  <Chip size="small" label={`${c.uso ?? 0} uso${c.uso === 1 ? '' : 's'}`} variant="outlined" sx={{ mr: 0.5 }} />
                  <IconButton size="small" onClick={() => setEditing({ id: c.id, nombre: c.nombre })}><EditIcon fontSize="small" /></IconButton>
                  <Tooltip title="Fusionar en otro concepto">
                    <IconButton size="small" onClick={() => { setMergeSource(c); setMergeTarget(null) }}><MergeIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title={(c.uso ?? 0) > 0 ? 'En uso: fusionalo en vez de borrar' : 'Borrar'}>
                    <span>
                      <IconButton size="small" disabled={(c.uso ?? 0) > 0} onClick={() => setConfirmDelete(c)}><DeleteIcon fontSize="small" /></IconButton>
                    </span>
                  </Tooltip>
                </Box>
              )
            }
          >
            {editing?.id === c.id ? (
              <TextField
                size="small" fullWidth autoFocus
                value={editing.nombre}
                onChange={e => setEditing(p => p ? { ...p, nombre: e.target.value } : p)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditing(null) }}
                sx={{ mr: 16 }}
              />
            ) : (
              <ListItemText primary={c.nombre} sx={{ pr: 18 }} />
            )}
          </ListItem>
        ))}
        {visibles.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {conceptos.length === 0 ? 'No hay conceptos aún.' : 'Sin resultados para esa búsqueda.'}
          </Typography>
        )}
      </List>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar concepto"
        message={`¿Seguro que querés eliminar "${confirmDelete?.nombre ?? ''}"? Esta acción no se puede deshacer.`}
        onConfirm={async () => { if (confirmDelete) await handleDelete(confirmDelete); setConfirmDelete(null) }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Diálogo de fusión */}
      <Dialog open={!!mergeSource} onClose={() => setMergeSource(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Fusionar concepto</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Todos los gastos y sub-items de <strong>{mergeSource?.nombre}</strong> se reasignan al
            concepto destino, y <strong>{mergeSource?.nombre}</strong> se elimina.
          </Typography>
          <AppSelect
            label="Concepto destino"
            options={conceptos.filter(c => c.id !== mergeSource?.id).map(c => ({ value: c.id, label: c.nombre }))}
            value={mergeTarget}
            onChange={(v) => setMergeTarget(v == null ? null : Number(v))}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setMergeSource(null)}>Cancelar</Button>
          <Button variant="contained" color="warning" startIcon={<MergeIcon />} disabled={!mergeTarget} onClick={handleMerge}>
            Fusionar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
