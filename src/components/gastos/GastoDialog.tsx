'use client'

import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import toast from 'react-hot-toast'
import GastoForm from './GastoForm'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
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
  const [confirmClose, setConfirmClose] = useState(false)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const handleRequestClose = () => {
    if (!loading) setConfirmClose(true)
  }

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
      // Al crear, si total_pagado > 0, generar el pago automáticamente con la fecha del gasto
      if (!gasto && Number(data.total_pagado) > 0) {
        const nuevo = await res.json()
        try {
          await fetch(`/api/gastos/${nuevo.id}/pagos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fecha: data.fecha_vencimiento, monto: Number(data.total_pagado) }),
          })
        } catch {
          toast.error('Gasto creado, pero falló la creación del pago inicial')
        }
      }
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
    <>
      <Dialog open={open} onClose={handleRequestClose} maxWidth="md" fullWidth fullScreen={isMobile} disableEscapeKeyDown={loading}>
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

      <ConfirmDialog
        open={confirmClose}
        title="¿Cerrar sin guardar?"
        message="Perdés los datos ingresados. ¿Querés cerrar de todas formas?"
        confirmLabel="Cerrar"
        confirmColor="warning"
        onConfirm={() => { setConfirmClose(false); onClose() }}
        onCancel={() => setConfirmClose(false)}
      />
    </>
  )
}
