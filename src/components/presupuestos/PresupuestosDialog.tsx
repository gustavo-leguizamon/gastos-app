'use client'

import { useEffect, useState, useCallback } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import toast from 'react-hot-toast'
import AppTextField from '@/components/shared/AppTextField'
import AppSelect from '@/components/shared/AppSelect'
import type { EjecucionPresupuesto, TotalesPresupuesto } from '@/lib/presupuestos-compute'
import type { Categoria } from '@/lib/types'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const COLOR: Record<string, string> = { ok: '#22c55e', cerca: '#f59e0b', excedido: '#ef4444' }

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

interface Respuesta {
  presupuestos: { id: number; categoria_id: number; monto: number }[]
  ejecucion: EjecucionPresupuesto[]
  totales: TotalesPresupuesto
}

interface Props {
  open: boolean
  mes: number
  anio: number
  onClose: () => void
}

/**
 * Presupuestos del mes: fijar el tope de cada categoría y ver cuánto se lleva consumido.
 *
 * Muestra **todas** las categorías con tope o con gasto, no sólo las presupuestadas: si una
 * categoría con gasto quedara oculta, el panel daría la impresión de que todo el gasto del
 * mes está bajo control cuando parte no está presupuestado.
 */
export default function PresupuestosDialog({ open, mes, anio, onClose }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [data, setData] = useState<Respuesta | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [nuevaCategoria, setNuevaCategoria] = useState<number | null>(null)
  const [nuevoMonto, setNuevoMonto] = useState('')
  const [cargando, setCargando] = useState(false)

  const load = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch(`/api/presupuestos?mes=${mes}&anio=${anio}`, { cache: 'no-store' })
      setData(await res.json())
    } finally {
      setCargando(false)
    }
  }, [mes, anio])

  useEffect(() => { if (open) load() }, [open, load])
  useEffect(() => {
    if (open) fetch('/api/categorias').then(r => r.json()).then(setCategorias).catch(() => {})
  }, [open])

  const guardar = async (categoriaId: number, monto: number) => {
    const res = await fetch('/api/presupuestos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria_id: categoriaId, mes, anio, monto }),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      toast.error(e.error ?? 'Error al guardar')
      return
    }
    await load()
  }

  const borrar = async (categoriaId: number) => {
    const fila = data?.presupuestos.find(p => p.categoria_id === categoriaId)
    if (!fila) return
    const res = await fetch(`/api/presupuestos/${fila.id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Error al quitar el presupuesto'); return }
    toast.success('Presupuesto quitado')
    await load()
  }

  const copiarMesAnterior = async () => {
    const res = await fetch('/api/presupuestos/copiar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes, anio }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(d.error ?? 'Error al copiar'); return }
    toast.success(
      d.omitidos > 0
        ? `${d.copiados} copiados, ${d.omitidos} ya estaban cargados`
        : `${d.copiados} presupuestos copiados`,
    )
    await load()
  }

  const agregar = async () => {
    const monto = Number(nuevoMonto.replace(',', '.'))
    if (nuevaCategoria == null || !Number.isFinite(monto) || monto < 0) {
      toast.error('Elegí una categoría y un monto válido')
      return
    }
    await guardar(nuevaCategoria, monto)
    setNuevaCategoria(null)
    setNuevoMonto('')
  }

  const totales = data?.totales
  // Sólo se ofrecen las categorías que todavía no tienen tope en el período.
  const yaConTope = new Set((data?.presupuestos ?? []).map(p => p.categoria_id))
  const disponibles = categorias.filter(c => !yaConTope.has(c.id))

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Presupuestos · {MESES[mes - 1]} {anio}
      </DialogTitle>
      <DialogContent dividers>
        {totales && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" fontWeight={700}>
                {fmtARS(totales.gastado)} de {fmtARS(totales.presupuestado)}
              </Typography>
              <Typography variant="body2" color={totales.restante < 0 ? 'error.main' : 'text.secondary'}>
                {totales.restante < 0 ? `${fmtARS(-totales.restante)} de más` : `${fmtARS(totales.restante)} disponible`}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, totales.consumido_pct ?? 0)}
              sx={{
                height: 8, borderRadius: 1,
                '& .MuiLinearProgress-bar': {
                  bgcolor: (totales.consumido_pct ?? 0) > 100 ? COLOR.excedido : COLOR.ok,
                },
              }}
            />
            {totales.sin_presupuesto > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Además, {fmtARS(totales.sin_presupuesto)} gastados en categorías sin presupuesto.
              </Typography>
            )}
            {totales.excedidas > 0 && (
              <Chip
                size="small"
                label={`${totales.excedidas} categoría${totales.excedidas === 1 ? '' : 's'} excedida${totales.excedidas === 1 ? '' : 's'}`}
                sx={{ mt: 1, color: COLOR.excedido, bgcolor: 'rgba(239,68,68,0.12)' }}
              />
            )}
          </Box>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {(data?.ejecucion ?? []).map(f => (
            <Box key={f.categoria_id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="body2" fontWeight={600} sx={{ flex: 1, minWidth: 0 }} noWrap>
                  {f.categoria_nombre}
                </Typography>
                <AppTextField
                  size="small"
                  placeholder="Sin tope"
                  defaultValue={f.monto ?? ''}
                  sx={{ width: 120 }}
                  inputProps={{ inputMode: 'decimal', style: { textAlign: 'right' } }}
                  onBlur={(e) => {
                    const v = e.target.value.trim().replace(',', '.')
                    if (v === '') return
                    const n = Number(v)
                    if (Number.isFinite(n) && n >= 0 && n !== f.monto) guardar(f.categoria_id, n)
                  }}
                />
                <Tooltip title={f.monto === null ? 'No tiene presupuesto' : 'Quitar presupuesto'}>
                  <span>
                    <IconButton size="small" disabled={f.monto === null} onClick={() => borrar(f.categoria_id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, f.consumido_pct ?? 0)}
                sx={{
                  height: 6, borderRadius: 1, mb: 0.5,
                  '& .MuiLinearProgress-bar': { bgcolor: COLOR[f.estado] },
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {fmtARS(f.gastado)}
                {f.monto === null
                  ? ' · sin presupuesto'
                  : ` de ${fmtARS(f.monto)}${f.consumido_pct !== null ? ` · ${f.consumido_pct.toFixed(0)}%` : ''}`}
                {f.restante !== null && f.restante < 0 && (
                  <Typography component="span" variant="caption" sx={{ color: COLOR.excedido, fontWeight: 700 }}>
                    {' '}· {fmtARS(-f.restante)} de más
                  </Typography>
                )}
              </Typography>
            </Box>
          ))}
          {!cargando && (data?.ejecucion ?? []).length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No hay presupuestos ni gastos con categoría en este mes.
            </Typography>
          )}
        </Box>

        {disponibles.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'flex-start' }}>
            <AppSelect
              label="Agregar categoría"
              options={disponibles.map(c => ({ value: c.id, label: c.nombre }))}
              value={nuevaCategoria}
              onChange={(v) => setNuevaCategoria(v == null ? null : Number(v))}
              sx={{ flex: 1 }}
            />
            <AppTextField
              size="small"
              label="Monto"
              value={nuevoMonto}
              onChange={(e) => setNuevoMonto(e.target.value)}
              sx={{ width: 120 }}
              inputProps={{ inputMode: 'decimal' }}
              onKeyDown={(e) => { if (e.key === 'Enter') agregar() }}
            />
            <Button onClick={agregar} disabled={nuevaCategoria == null}>Agregar</Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button startIcon={<ContentCopyIcon />} onClick={copiarMesAnterior}>
          Copiar del mes anterior
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" onClick={onClose}>Listo</Button>
      </DialogActions>
    </Dialog>
  )
}
