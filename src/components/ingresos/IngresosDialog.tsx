'use client'

import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import IngresoForm from './IngresoForm'
import { useIngresos, type IngresoInput } from './useIngresos'
import type { Casa, Ingreso, Moneda, FiltrosGastos } from '@/lib/types'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

interface Props {
  open: boolean
  filtros: FiltrosGastos
  onClose: () => void
  /** Se llama tras cada alta/edición/borrado para refrescar las cards del resumen. */
  onChanged: () => void
}

/** ABM rápido de los ingresos del mes visible, abierto desde la card "Ingresos". */
export default function IngresosDialog({ open, filtros, onClose, onChanged }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { ingresos, total, loading, saving, guardar, eliminar } = useIngresos(filtros.mes, filtros.anio, filtros.casa_id)
  const [casas, setCasas] = useState<Casa[]>([])
  const [monedas, setMonedas] = useState<Moneda[]>([])
  const [editing, setEditing] = useState<Ingreso | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    fetch('/api/casas').then((r) => r.json()).then(setCasas).catch(() => setCasas([]))
    fetch('/api/monedas').then((r) => r.json()).then(setMonedas).catch(() => setMonedas([]))
  }, [open])

  // Al cerrar y volver a abrir, no arrastrar la edición anterior.
  useEffect(() => { if (!open) setEditing(null) }, [open])

  const onSubmit = async (input: IngresoInput, id?: number) => {
    const ok = await guardar(input, id)
    if (ok) onChanged()
    return ok
  }

  const onDelete = async (id: number) => {
    setDeletingId(id)
    const ok = await eliminar(id)
    if (ok) {
      onChanged()
      if (editing?.id === id) setEditing(null)
    }
    setDeletingId(null)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Ingresos — {MESES[filtros.mes - 1]} {filtros.anio}
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 2 }}>
          <Typography variant="caption" color="text.secondary">Total del mes</Typography>
          <Typography fontWeight={700} color="success.main">{fmtARS(total)}</Typography>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={20} /></Box>
        ) : ingresos.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            No hay ingresos cargados para este mes.
          </Typography>
        ) : (
          <Box sx={{ mb: 2 }}>
            {ingresos.map((i) => (
              <Box
                key={i.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  py: 0.75,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: editing?.id === i.id ? 'action.hover' : undefined,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600}>{fmtARS(i.monto_ars)}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {/* El monto original sólo se repite si no era ARS — si no, sería ruido. */}
                    {i.moneda_codigo && i.moneda_codigo !== 'ARS'
                      ? `${i.moneda_simbolo ?? ''}${i.monto_moneda.toLocaleString('es-AR')} ${i.moneda_codigo} @ ${i.tipo_cambio} · `
                      : ''}
                    {i.fecha}{i.descripcion ? ` · ${i.descripcion}` : ''}{i.casa_nombre ? ` · ${i.casa_nombre}` : ''}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexShrink: 0 }}>
                  <IconButton size="small" onClick={() => setEditing(i)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => onDelete(i.id)} disabled={deletingId === i.id}>
                    {deletingId === i.id ? <CircularProgress size={14} /> : <DeleteIcon fontSize="small" />}
                  </IconButton>
                </Box>
              </Box>
            ))}
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />

        <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
          {editing ? 'Editar ingreso' : 'Nuevo ingreso'}
        </Typography>
        <IngresoForm
          mes={filtros.mes}
          anio={filtros.anio}
          casas={casas}
          monedas={monedas}
          editing={editing}
          onSubmit={onSubmit}
          onCancelEdit={() => setEditing(null)}
          saving={saving}
          layout="stack"
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}
