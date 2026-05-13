'use client'

import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import toast from 'react-hot-toast'
import GastoForm from './GastoForm'
import type { Gasto, GastoFormData, FiltrosGastos } from '@/lib/types'

interface Props {
  open: boolean
  gasto: Gasto | null
  filtros: FiltrosGastos
  onClose: () => void
  onSaved: () => void
}

const FORM_ID = 'gasto-form'

export default function GastoDialog({ open, gasto, filtros, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (data: GastoFormData) => {
    setLoading(true)
    try {
      const url = gasto ? `/api/gastos/${gasto.id}` : '/api/gastos'
      const method = gasto ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Error al guardar')
      toast.success(gasto ? 'Gasto actualizado' : 'Gasto creado')
      onSaved()
      onClose()
    } catch {
      toast.error('Error al guardar el gasto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {gasto ? 'Editar Gasto' : 'Nuevo Gasto'}
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 2 }}>
        <GastoForm
          gasto={gasto}
          defaultMes={filtros.mes}
          defaultAnio={filtros.anio}
          onSubmit={handleSubmit}
          formId={FORM_ID}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          type="submit"
          form={FORM_ID}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          {loading ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
