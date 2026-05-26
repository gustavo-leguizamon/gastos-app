'use client'

import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import AppSelect from '@/components/shared/AppSelect'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import toast from 'react-hot-toast'
import type { FiltrosGastos, Gasto } from '@/lib/types'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

interface Props {
  open: boolean
  filtros: FiltrosGastos
  onClose: () => void
  onCopied: () => void
}

export default function CopiarMesDialog({ open, filtros, onClose, onCopied }: Props) {
  const now = new Date()

  const [srcMes, setSrcMes] = useState(filtros.mes)
  const [srcAnio, setSrcAnio] = useState(filtros.anio)
  const [dstMes, setDstMes] = useState(filtros.mes === 12 ? 1 : filtros.mes + 1)
  const [dstAnio, setDstAnio] = useState(filtros.mes === 12 ? filtros.anio + 1 : filtros.anio)
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [loadingGastos, setLoadingGastos] = useState(false)
  const [copying, setCopying] = useState(false)
  const [progress, setProgress] = useState(0)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i)

  useEffect(() => {
    if (!open) return
    setSrcMes(filtros.mes)
    setSrcAnio(filtros.anio)
    setDstMes(filtros.mes === 12 ? 1 : filtros.mes + 1)
    setDstAnio(filtros.mes === 12 ? filtros.anio + 1 : filtros.anio)
  }, [open, filtros])

  useEffect(() => {
    if (!open) return
    setLoadingGastos(true)
    fetch(`/api/gastos?mes=${srcMes}&anio=${srcAnio}`)
      .then(r => r.json())
      .then(data => setGastos(Array.isArray(data) ? data : []))
      .finally(() => setLoadingGastos(false))
  }, [open, srcMes, srcAnio])

  const handleCopy = async () => {
    if (gastos.length === 0) return
    setCopying(true)
    setProgress(0)
    let copied = 0
    let errors = 0

    for (const g of gastos) {
      try {
        const diaVenc = g.fecha_vencimiento.split('-')[2]
        const nuevaFecha = `${dstAnio}-${String(dstMes).padStart(2, '0')}-${diaVenc}`

        const res = await fetch('/api/gastos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            casa_id: g.casa_id,
            descripcion: g.descripcion,
            fecha_vencimiento: nuevaFecha,
            tipo_pago: g.tipo_pago,
            moneda_id: g.moneda_id,
            tipo_cambio: g.tipo_cambio,
            total_moneda: g.total_moneda,
            total_pagado: 0,
            pasaje_mes_siguiente: 0,
            prestamo_a_otro: 0,
            tarjeta_id: g.tarjeta_id,
            cuota_actual: g.cuota_actual,
            cuotas_totales: g.cuotas_totales,
            mes: dstMes,
            anio: dstAnio,
            notas: g.notas ?? '',
            confirmado: false,
            categoria_id: g.categoria_id,
            es_tarjeta: g.es_tarjeta,
          }),
        })
        if (!res.ok) throw new Error()
        const nuevo = await res.json()

        if (g.items?.length) {
          await Promise.all(g.items.map(item =>
            fetch(`/api/gastos/${nuevo.id}/items`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                descripcion: item.descripcion,
                monto: item.monto,
                fecha: item.fecha,
                cuota_actual: item.cuota_actual,
                cuotas_totales: item.cuotas_totales,
                incluye_en_total: item.incluye_en_total,
                incluye_en_vencimiento: item.incluye_en_vencimiento,
                categoria_id: item.categoria_id,
              }),
            })
          ))
        }
        copied++
      } catch {
        errors++
      }
      setProgress(Math.round(((copied + errors) / gastos.length) * 100))
    }

    setCopying(false)
    if (errors === 0) {
      toast.success(`${copied} gasto${copied !== 1 ? 's' : ''} copiado${copied !== 1 ? 's' : ''} a ${MESES[dstMes - 1]} ${dstAnio}`)
    } else {
      toast.error(`${copied} copiados, ${errors} con error`)
    }
    onClose()
    onCopied()
  }

  const sameMonthYear = srcMes === dstMes && srcAnio === dstAnio

  return (
    <Dialog open={open} onClose={copying ? undefined : onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
        <ContentCopyIcon color="primary" />
        Copiar mes completo
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 2, mb: 3 }}>
          {/* Origen */}
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Desde
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <AppSelect
                label="Mes"
                options={MESES.map((n, i) => ({ value: i + 1, label: n }))}
                value={srcMes}
                onChange={(v) => setSrcMes(Number(v))}
                disableClearable
                sx={{ flex: 1 }}
              />
              <AppSelect
                label="Año"
                options={years.map(y => ({ value: y, label: String(y) }))}
                value={srcAnio}
                onChange={(v) => setSrcAnio(Number(v))}
                disableClearable
                sx={{ width: 90 }}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'center', mt: { xs: 0, sm: 2.5 } }}>
            {isMobile ? <ArrowDownwardIcon sx={{ color: 'text.disabled' }} /> : <ArrowForwardIcon sx={{ color: 'text.disabled' }} />}
          </Box>

          {/* Destino */}
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Hacia
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <AppSelect
                label="Mes"
                options={MESES.map((n, i) => ({ value: i + 1, label: n }))}
                value={dstMes}
                onChange={(v) => setDstMes(Number(v))}
                disableClearable
                sx={{ flex: 1 }}
              />
              <AppSelect
                label="Año"
                options={years.map(y => ({ value: y, label: String(y) }))}
                value={dstAnio}
                onChange={(v) => setDstAnio(Number(v))}
                disableClearable
                sx={{ width: 90 }}
              />
            </Box>
          </Box>
        </Box>

        {/* Resumen */}
        <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1, p: 1.5 }}>
          {loadingGastos ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={14} />
              <Typography variant="body2" color="text.secondary">Cargando gastos…</Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {gastos.length === 0
                ? `No hay gastos en ${MESES[srcMes - 1]} ${srcAnio}.`
                : <>Se copiarán <strong style={{ color: '#fff' }}>{gastos.length} gasto{gastos.length !== 1 ? 's' : ''}</strong>
                  {gastos.filter(g => g.items?.length > 0).length > 0 &&
                    <> (incluye sub-items de {gastos.filter(g => g.items?.length > 0).length} fila{gastos.filter(g => g.items?.length > 0).length !== 1 ? 's' : ''})</>
                  } a <strong style={{ color: '#fff' }}>{MESES[dstMes - 1]} {dstAnio}</strong>.
                  <br />Los pagos, total pagado, pasaje y préstamo se resetean. Todos quedarán como <strong style={{ color: '#f59e0b' }}>no confirmados</strong>.</>
              }
            </Typography>
          )}
        </Box>

        {copying && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Copiando… {progress}%
            </Typography>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
        )}

        {sameMonthYear && (
          <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
            El mes/año de origen y destino son iguales.
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={copying}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleCopy}
          disabled={copying || loadingGastos || gastos.length === 0 || sameMonthYear}
          startIcon={copying ? <CircularProgress size={16} color="inherit" /> : <ContentCopyIcon />}
        >
          Copiar {gastos.length > 0 ? `${gastos.length} gasto${gastos.length !== 1 ? 's' : ''}` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
