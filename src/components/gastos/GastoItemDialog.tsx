'use client'

import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@/components/shared/AppTextField'
import Autocomplete from '@mui/material/Autocomplete'
import AppDateField from '@/components/shared/AppDateField'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import AppToggle from '@/components/shared/AppToggle'
import AppMultiSelect from '@/components/shared/AppMultiSelect'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight'
import toast from 'react-hot-toast'
import type { Gasto, GastoItem, Categoria } from '@/lib/types'

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

type EditState = {
  id: number
  descripcion: string
  monto: string
  fecha: string
  cuota_actual: string
  cuotas_totales: string
  incluye_en_total: boolean
  incluye_en_vencimiento: boolean
  verificado: boolean
  categoria_ids: number[]
}

interface Props {
  open: boolean
  gasto: Gasto | null
  onClose: () => void
  onChanged: (fullReload?: boolean) => void
}

export default function GastoItemDialog({ open, gasto, onClose, onChanged }: Props) {
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState('')
  const [cuotaActual, setCuotaActual] = useState('')
  const [cuotasTotales, setCuotasTotales] = useState('')
  const [incluyeEnTotal, setIncluyeEnTotal] = useState(true)
  const [incluyeEnVencimiento, setIncluyeEnVencimiento] = useState(false)
  const [categoriaIds, setCategoriaIds] = useState<number[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [descripciones, setDescripciones] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editing, setEditing] = useState<EditState | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [filtroItems, setFiltroItems] = useState('')
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  useEffect(() => {
    fetch('/api/categorias').then(r => r.json()).then(setCategorias)
  }, [])

  useEffect(() => {
    if (!gasto) return
    const params = new URLSearchParams({ parent: gasto.descripcion })
    fetch(`/api/items/descripciones?${params}`)
      .then(r => r.json())
      .then(d => setDescripciones(Array.isArray(d) ? d : []))
      .catch(() => setDescripciones([]))
  }, [gasto?.descripcion])

  if (!gasto) return null

  const items: GastoItem[] = gasto.items ?? []
  const totalItems = items.reduce((s, i) => s + i.monto, 0)

  const startEdit = (item: GastoItem) => setEditing({
    id: item.id,
    descripcion: item.descripcion,
    monto: String(item.monto),
    fecha: item.fecha ?? '',
    cuota_actual: item.cuota_actual != null ? String(item.cuota_actual) : '',
    cuotas_totales: item.cuotas_totales != null ? String(item.cuotas_totales) : '',
    incluye_en_total: item.incluye_en_total,
    incluye_en_vencimiento: item.incluye_en_vencimiento,
    verificado: item.verificado,
    categoria_ids: item.categoria_ids ?? [],
  })

  const handleSaveEdit = async () => {
    if (!editing || !editing.descripcion.trim() || !editing.monto) return
    const montoNum = parseFloat(editing.monto)
    if (isNaN(montoNum)) { toast.error('Monto inválido'); return }
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/gastos/${gasto.id}/items/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: editing.descripcion.trim(),
          monto: montoNum,
          fecha: editing.fecha || null,
          cuota_actual: editing.cuota_actual ? Number(editing.cuota_actual) : null,
          cuotas_totales: editing.cuotas_totales ? Number(editing.cuotas_totales) : null,
          incluye_en_total: editing.incluye_en_total,
          incluye_en_vencimiento: editing.incluye_en_vencimiento,
          verificado: editing.verificado,
          categoria_ids: editing.categoria_ids,
        }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      toast.success('Item actualizado')
      setEditing(null)
      onChanged(!!updated?.synced_pago)
    } catch {
      toast.error('Error al actualizar item')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleAdd = async () => {
    if (!descripcion.trim() || !monto) { toast.error('Descripción y monto son requeridos'); return }
    const montoNum = parseFloat(monto)
    if (isNaN(montoNum)) { toast.error('Ingresá un monto válido'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/gastos/${gasto.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: descripcion.trim(),
          monto: montoNum,
          fecha: fecha || null,
          cuota_actual: cuotaActual ? Number(cuotaActual) : null,
          cuotas_totales: cuotasTotales ? Number(cuotasTotales) : null,
          incluye_en_total: incluyeEnTotal,
          incluye_en_vencimiento: incluyeEnVencimiento,
          categoria_ids: categoriaIds,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Item agregado')
      setDescripcion(''); setMonto(''); setFecha(''); setCuotaActual(''); setCuotasTotales('')
      setIncluyeEnTotal(true); setIncluyeEnVencimiento(false); setCategoriaIds([])
      onChanged()
    } catch {
      toast.error('Error al agregar item')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (itemId: number) => {
    setDeletingId(itemId)
    try {
      const res = await fetch(`/api/gastos/${gasto.id}/items/${itemId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Item eliminado')
      onChanged()
    } catch {
      toast.error('Error al eliminar item')
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleVerificado = async (item: GastoItem) => {
    try {
      const res = await fetch(`/api/gastos/${gasto.id}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificado: !item.verificado }),
      })
      if (!res.ok) throw new Error()
      onChanged()
    } catch {
      toast.error('Error al actualizar')
    }
  }

  const sortedItems = [...items]
    .filter(i => {
      if (!filtroItems.trim()) return true
      const q = filtroItems.toLowerCase()
      return i.descripcion.toLowerCase().includes(q) || (i.categorias ?? []).some(c => c.nombre.toLowerCase().includes(q))
    })
    .sort((a, b) => {
      if (a.incluye_en_vencimiento !== b.incluye_en_vencimiento) {
        return a.incluye_en_vencimiento ? -1 : 1
      }
      if (a.fecha && b.fecha) {
        const cmp = a.fecha.localeCompare(b.fecha)
        if (cmp !== 0) return cmp
      } else if (!a.fecha && b.fecha) {
        return 1
      } else if (a.fecha && !b.fecha) {
        return -1
      }
      return a.id - b.id
    })

  const addItemFields = (
    <>
      <Autocomplete
        freeSolo
        options={descripciones}
        value={descripcion}
        onInputChange={(_, val) => setDescripcion(val)}
        onChange={(_, val) => setDescripcion(val ?? '')}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small" label="Descripción" fullWidth
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
        )}
      />
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <TextField
          size="small" label="Monto (ARS)" type="number" sx={{ flex: 1 }}
          value={monto} onChange={e => setMonto(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          inputProps={{ step: 0.01 }}
        />
        <AppDateField
          size="small" label="Fecha (opcional)" sx={{ width: 155 }}
          value={fecha} onChange={e => setFecha(e.target.value)}
        />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TextField
          size="small" label="Cuota" type="number" sx={{ width: 90 }}
          value={cuotaActual} onChange={e => setCuotaActual(e.target.value)}
          inputProps={{ min: 1, step: 1 }}
        />
        <Typography sx={{ color: 'text.secondary' }}>/</Typography>
        <TextField
          size="small" label="Total" type="number" sx={{ width: 90 }}
          value={cuotasTotales} onChange={e => setCuotasTotales(e.target.value)}
          inputProps={{ min: 1, step: 1 }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>(opcional)</Typography>
      </Box>
      <AppMultiSelect
        label="Categorías (opcional)"
        options={categorias.map(l => ({ value: l.id, label: l.nombre }))}
        value={categoriaIds}
        onChange={(v) => setCategoriaIds(v.map(Number))}
        fullWidth
        placeholder="Sin especificar"
      />
      <Box sx={{ display: 'flex', gap: 2 }}>
        <AppToggle
          size="small" checked={incluyeEnTotal} onChange={e => setIncluyeEnTotal(e.target.checked)}
          label={<Typography variant="caption">Incluir en total</Typography>}
        />
        <AppToggle
          size="small" checked={incluyeEnVencimiento} onChange={e => setIncluyeEnVencimiento(e.target.checked)}
          label={<Typography variant="caption">Incluir en vencimiento</Typography>}
        />
      </Box>
      <Button
        variant="contained"
        startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
        onClick={handleAdd} disabled={saving}
      >
        Agregar
      </Button>
    </>
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{ sx: { height: isMobile ? '100%' : '90vh' } }}
    >
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, fontSize: { xs: 16, sm: 20 } }}>
        <SubdirectoryArrowRightIcon color="primary" />
        Sub-items — {gasto.descripcion}
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, overflow: 'hidden' }}>
        {/* Columna izquierda en md+, fila superior en mobile: resumen + formulario */}
        <Box sx={{ width: { xs: '100%', md: 340 }, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: { xs: 'none', md: '1px solid' }, borderBottom: { xs: '1px solid', md: 'none' }, borderColor: 'divider', overflowY: 'auto' }}>
          {/* Resumen */}
          <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Total gasto</Typography>
              <Typography fontWeight={700} fontSize={13}>{fmtARS(gasto.total_ars)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Suma sub-items</Typography>
              <Typography fontWeight={700} fontSize={13} color={totalItems > gasto.total_ars ? 'error.main' : 'text.primary'}>
                {fmtARS(totalItems)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Sin asignar</Typography>
              <Typography fontWeight={700} fontSize={13} color="text.secondary">
                {fmtARS(gasto.total_ars - totalItems)}
              </Typography>
            </Box>
          </Box>

          {/* Formulario nuevo item — Accordion colapsable en mobile, fijo en desktop */}
          {isMobile ? (
            <Accordion
              disableGutters
              elevation={0}
              square
              sx={{ bgcolor: 'transparent', '&:before': { display: 'none' }, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AddIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle2" fontWeight={700}>Agregar sub-item</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 2, pt: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {addItemFields}
              </AccordionDetails>
            </Accordion>
          ) : (
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>Agregar sub-item</Typography>
              {addItemFields}
            </Box>
          )}
        </Box>

        {/* Columna derecha: lista de items */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
          {items.length > 0 && (
            <Box sx={{ px: 1, pb: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Buscar sub-item…"
                value={filtroItems}
                onChange={e => setFiltroItems(e.target.value)}
              />
            </Box>
          )}
          {sortedItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              {items.length === 0 ? 'No hay sub-items cargados aún.' : 'No se encontraron sub-items para esa búsqueda.'}
            </Typography>
          ) : (
            sortedItems.map(item => (
              <Box key={item.id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                {editing?.id === item.id ? (
                  <Box sx={{ py: 1.5, px: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Autocomplete
                      freeSolo
                      options={descripciones}
                      value={editing.descripcion}
                      onInputChange={(_, val) => setEditing(p => p ? { ...p, descripcion: val } : p)}
                      onChange={(_, val) => setEditing(p => p ? { ...p, descripcion: val ?? '' } : p)}
                      renderInput={(params) => (
                        <TextField {...params} size="small" fullWidth autoFocus label="Descripción" />
                      )}
                    />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        size="small" label="Monto (ARS)" type="number" sx={{ flex: 1 }}
                        value={editing.monto}
                        onChange={e => setEditing(p => p ? { ...p, monto: e.target.value } : p)}
                        inputProps={{ step: 0.01 }}
                      />
                      <AppDateField
                        size="small" label="Fecha (opcional)" sx={{ width: 150 }}
                        value={editing.fecha}
                        onChange={e => setEditing(p => p ? { ...p, fecha: e.target.value } : p)}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TextField
                        size="small" label="Cuota" type="number" sx={{ width: 90 }}
                        value={editing.cuota_actual}
                        onChange={e => setEditing(p => p ? { ...p, cuota_actual: e.target.value } : p)}
                        inputProps={{ min: 1, step: 1 }}
                      />
                      <Typography sx={{ color: 'text.secondary' }}>/</Typography>
                      <TextField
                        size="small" label="Total" type="number" sx={{ width: 90 }}
                        value={editing.cuotas_totales}
                        onChange={e => setEditing(p => p ? { ...p, cuotas_totales: e.target.value } : p)}
                        inputProps={{ min: 1, step: 1 }}
                      />
                    </Box>
                    <AppMultiSelect
                      label="Categorías (opcional)"
                      options={categorias.map(l => ({ value: l.id, label: l.nombre }))}
                      value={editing.categoria_ids ?? []}
                      onChange={(v) => setEditing(p => p ? { ...p, categoria_ids: v.map(Number) } : p)}
                      fullWidth
                      placeholder="Sin especificar"
                    />
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <AppToggle
                        size="small" checked={editing.incluye_en_total} onChange={e => setEditing(p => p ? { ...p, incluye_en_total: e.target.checked } : p)}
                        label={<Typography variant="caption">Incluir en total</Typography>}
                      />
                      <AppToggle
                        size="small" checked={editing.incluye_en_vencimiento} onChange={e => setEditing(p => p ? { ...p, incluye_en_vencimiento: e.target.checked } : p)}
                        label={<Typography variant="caption">Incluir en vencimiento</Typography>}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small" variant="contained"
                        startIcon={savingEdit ? <CircularProgress size={14} color="inherit" /> : <CheckIcon />}
                        onClick={handleSaveEdit} disabled={savingEdit}
                      >
                        Guardar
                      </Button>
                      <Button size="small" startIcon={<CloseIcon />} onClick={() => setEditing(null)}>
                        Cancelar
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{
                    display: 'flex', alignItems: 'center', py: 0.75, px: 1, gap: 1,
                    bgcolor: item.verificado ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.10)',
                  }}>
                    <Tooltip title={item.verificado ? 'Verificado — clic para desmarcar' : 'Marcar como correcto'}>
                      <IconButton size="small" onClick={() => handleToggleVerificado(item)} sx={{ flexShrink: 0 }}>
                        {item.verificado
                          ? <CheckCircleIcon fontSize="small" sx={{ color: '#22c55e' }} />
                          : <RadioButtonUncheckedIcon fontSize="small" sx={{ color: '#f59e0b' }} />}
                      </IconButton>
                    </Tooltip>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap>{item.descripcion}</Typography>
                      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                        {item.fecha && <Typography variant="caption" color="text.secondary">{item.fecha}</Typography>}
                        {item.cuota_actual != null && (
                          <Typography variant="caption" color="primary.main">
                            Cuota {item.cuota_actual}{item.cuotas_totales != null ? `/${item.cuotas_totales}` : ''}
                          </Typography>
                        )}
                        {(item.categorias ?? []).map(c => (
                          <Typography key={c.id} variant="caption" color="text.secondary">
                            📍 {c.nombre}
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                    <Typography variant="body2" fontWeight={600} sx={{ flexShrink: 0 }}>
                      {fmtARS(item.monto)}
                    </Typography>
                    <IconButton size="small" onClick={() => startEdit(item)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(item.id)} disabled={deletingId === item.id}>
                      {deletingId === item.id ? <CircularProgress size={14} /> : <DeleteIcon fontSize="small" />}
                    </IconButton>
                  </Box>
                )}
              </Box>
            ))
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}
