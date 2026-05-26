'use client'

import { useEffect, useState } from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import TextField from '@/components/shared/AppTextField'
import AppDateField from '@/components/shared/AppDateField'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import Divider from '@mui/material/Divider'
import toast from 'react-hot-toast'
import type { TarjetaCierre } from '@/lib/types'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

interface FormState {
  mes: number
  anio: number
  fecha_cierre: string
  fecha_vencimiento: string
  fecha_proximo_cierre: string
}

const now = new Date()
const emptyForm = (): FormState => ({
  mes: now.getMonth() + 1,
  anio: now.getFullYear(),
  fecha_cierre: '',
  fecha_vencimiento: '',
  fecha_proximo_cierre: '',
})

export default function TarjetaCierres({ tarjetaId, onCierresChange }: { tarjetaId: number; onCierresChange?: () => void }) {
  const [cierres, setCierres] = useState<TarjetaCierre[]>([])
  const [form, setForm] = useState<FormState>(emptyForm())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const load = () =>
    fetch(`/api/tarjetas/${tarjetaId}/cierres`)
      .then(r => r.json())
      .then(setCierres)

  useEffect(() => { load() }, [tarjetaId])

  const resetForm = () => { setForm(emptyForm()); setEditingId(null); setFormOpen(false) }

  const handleSubmit = async () => {
    const payload = {
      mes: form.mes,
      anio: form.anio,
      fecha_cierre: form.fecha_cierre || null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      fecha_proximo_cierre: form.fecha_proximo_cierre || null,
    }
    try {
      if (editingId) {
        const res = await fetch(`/api/tarjetas/${tarjetaId}/cierres/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error()
        toast.success('Cierre actualizado')
      } else {
        const res = await fetch(`/api/tarjetas/${tarjetaId}/cierres`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const txt = await res.text()
          if (txt.includes('Unique')) toast.error('Ya existe un cierre para ese mes/año')
          else toast.error('Error al guardar')
          return
        }
        toast.success('Cierre agregado')
      }
      resetForm()
      await load()
      onCierresChange?.()
    } catch {
      toast.error('Error al guardar')
    }
  }

  const handleEdit = (c: TarjetaCierre) => {
    setEditingId(c.id)
    setForm({
      mes: c.mes,
      anio: c.anio,
      fecha_cierre: c.fecha_cierre ?? '',
      fecha_vencimiento: c.fecha_vencimiento ?? '',
      fecha_proximo_cierre: c.fecha_proximo_cierre ?? '',
    })
    setFormOpen(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/tarjetas/${tarjetaId}/cierres/${id}`, { method: 'DELETE' })
      toast.success('Cierre eliminado')
      await load()
      onCierresChange?.()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  return (
    <Box>
      <Accordion
        expanded={formOpen}
        onChange={(_, exp) => setFormOpen(exp)}
        disableGutters
        sx={{
          boxShadow: 'none',
          bgcolor: 'transparent',
          '&:before': { display: 'none' },
          mb: 1,
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon fontSize="small" />}
          sx={{
            minHeight: 0,
            px: 1,
            '& .MuiAccordionSummary-content': { my: 0.5 },
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {editingId ? 'Editar cierre' : 'Agregar cierre'}
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 1, pt: 0 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                select size="small" label="Mes" sx={{ flex: 1 }}
                SelectProps={{ native: true }}
                value={form.mes}
                onChange={e => setForm(p => ({ ...p, mes: Number(e.target.value) }))}
              >
                {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </TextField>
              <TextField
                size="small" type="number" label="Año" sx={{ flex: 1 }}
                value={form.anio}
                onChange={e => setForm(p => ({ ...p, anio: Number(e.target.value) || p.anio }))}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
              <AppDateField sx={{ flex: 1, minWidth: 140 }} size="small" label="Fecha de cierre" value={form.fecha_cierre} onChange={e => setForm(p => ({ ...p, fecha_cierre: e.target.value }))} />
              <AppDateField sx={{ flex: 1, minWidth: 140 }} size="small" label="Fecha de vencimiento" value={form.fecha_vencimiento} onChange={e => setForm(p => ({ ...p, fecha_vencimiento: e.target.value }))} />
              <AppDateField sx={{ flex: 1, minWidth: 140 }} size="small" label="Fecha de próximo cierre" value={form.fecha_proximo_cierre} onChange={e => setForm(p => ({ ...p, fecha_proximo_cierre: e.target.value }))} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" variant="contained" startIcon={editingId ? <CheckIcon /> : <AddIcon />} onClick={handleSubmit}>
                {editingId ? 'Guardar' : 'Agregar'}
              </Button>
              <Button size="small" startIcon={<CloseIcon />} onClick={resetForm}>Cancelar</Button>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      <Divider sx={{ mb: 1 }} />

      {cierres.length === 0 ? (
        <Typography variant="caption" color="text.disabled">Aún no hay cierres cargados.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {cierres.map(c => (
            <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={600}>{MESES[c.mes - 1]} {c.anio}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Cierre: {c.fecha_cierre || '—'} · Venc: {c.fecha_vencimiento || '—'} · Próx: {c.fecha_proximo_cierre || '—'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                <IconButton size="small" onClick={() => handleEdit(c)}><EditIcon fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => handleDelete(c.id)}><DeleteIcon fontSize="small" /></IconButton>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
