'use client'

import { useRef, useState } from 'react'
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
import { aplicarPropina } from '@/lib/propina'
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
  // "Guardar y cargar otro": el diálogo queda abierto y el form se limpia conservando el contexto.
  const [resetSignal, setResetSignal] = useState(0)
  const seguirCargando = useRef(false)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const handleRequestClose = () => {
    if (!loading) setConfirmClose(true)
  }

  /**
   * Crea un gasto y, si corresponde, su pago inicial: con "pagado completo" por el total del
   * gasto en ARS; si no, por `total_pagado` cuando es distinto de cero. Se acepta cualquier
   * monto no nulo (incluye negativos, ej. devoluciones) para que propague el sub-item a la
   * tarjeta. Un pago fallido no tumba el alta: el gasto ya existe, se avisa y sigue.
   */
  const crearGastoConPago = async (data: GastoFormData, etiquetaError: string) => {
    const res = await fetch('/api/gastos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Error al guardar')

    const totalArs = Number(data.total_moneda) * Number(data.tipo_cambio || 1)
    const montoPago = data.pagado_completo ? totalArs : Number(data.total_pagado)
    if (montoPago === 0) return

    const nuevo = await res.json()
    try {
      const pagoRes = await fetch(`/api/gastos/${nuevo.id}/pagos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: data.fecha_vencimiento, monto: montoPago }),
      })
      if (!pagoRes.ok) {
        const msg = await pagoRes.json().then(d => d?.error).catch(() => null)
        toast.error(msg || etiquetaError)
      }
    } catch {
      toast.error(etiquetaError)
    }
  }

  const handleSubmit = async (data: GastoFormData) => {
    setLoading(true)
    try {
      if (gasto) {
        const res = await fetch(`/api/gastos/${gasto.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Error al guardar')
      } else {
        // La propina se carga en el mismo form pero se persiste como un gasto aparte.
        const { principal, propina } = aplicarPropina(data)
        await crearGastoConPago(principal, 'Gasto creado, pero falló la creación del pago inicial')
        if (propina) {
          // Los dos POST no son atómicos. Si el segundo falla, el principal ya quedó
          // guardado: se avisa y se sigue en vez de perder la carga entera.
          try {
            await crearGastoConPago(propina, 'Propina creada, pero falló la creación de su pago')
          } catch {
            toast.error('Gasto creado, pero falló el gasto de la propina — cargala aparte')
          }
        }
      }
      toast.success(gasto ? 'Gasto actualizado' : 'Gasto creado')
      onSaved()
      if (seguirCargando.current) {
        setResetSignal(n => n + 1)
      } else {
        onClose()
      }
    } catch {
      toast.error('Error al guardar el gasto')
    } finally {
      seguirCargando.current = false
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
            resetSignal={resetSignal}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={loading}>Cancelar</Button>
          {!gasto && (
            <Button
              type="submit"
              form={FORM_ID}
              disabled={loading}
              onClick={() => { seguirCargando.current = true }}
            >
              Guardar y cargar otro
            </Button>
          )}
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
