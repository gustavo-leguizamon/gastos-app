'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckIcon from '@mui/icons-material/Check'
import toast from 'react-hot-toast'
import AppTextField from '@/components/shared/AppTextField'
import AppSelect from '@/components/shared/AppSelect'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { useGastosStore } from '@/store/gastosStore'
import { shiftMonth } from '@/lib/fechas'
import type { Categoria, EjecucionPresupuesto, PresupuestosResponse } from '@/lib/types'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

const COLOR: Record<EjecucionPresupuesto['estado'], string> = {
  ok: '#22c55e',
  cerca: '#f59e0b',
  excedido: '#ef4444',
}

export default function PresupuestosPage() {
  // Comparte el período con el resto de la app: cambiar de mes acá lo cambia en Gastos.
  const filtros = useGastosStore(s => s.filtros)
  const setFiltros = useGastosStore(s => s.setFiltros)

  const [data, setData] = useState<PresupuestosResponse | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [nuevaCategoria, setNuevaCategoria] = useState<number | null>(null)
  const [nuevoMonto, setNuevoMonto] = useState('')
  const [aBorrar, setABorrar] = useState<EjecucionPresupuesto | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/presupuestos?mes=${filtros.mes}&anio=${filtros.anio}`, { cache: 'no-store' })
      setData(await r.json())
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [filtros.mes, filtros.anio])

  useEffect(() => { load() }, [load])
  useEffect(() => { fetch('/api/categorias').then(r => r.json()).then(setCategorias).catch(() => {}) }, [])

  const guardar = async (categoriaId: number, monto: number) => {
    const res = await fetch('/api/presupuestos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria_id: categoriaId, mes: filtros.mes, anio: filtros.anio, monto }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(d.error ?? 'Error al guardar'); return false }
    await load()
    return true
  }

  const handleAgregar = async () => {
    const monto = Number(nuevoMonto.replace(',', '.'))
    if (nuevaCategoria == null || !Number.isFinite(monto) || monto < 0) {
      toast.error('Elegí una categoría y un monto válido')
      return
    }
    if (await guardar(nuevaCategoria, monto)) {
      setNuevaCategoria(null)
      setNuevoMonto('')
      toast.success('Presupuesto guardado')
    }
  }

  const handleBorrar = async () => {
    if (!aBorrar || !data) return
    const p = data.presupuestos.find(x => x.categoria_id === aBorrar.categoria_id)
    if (!p) return
    const res = await fetch(`/api/presupuestos/${p.id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Error al borrar'); return }
    setABorrar(null)
    toast.success('Presupuesto quitado')
    await load()
  }

  const navegar = (n: number) => {
    const { mes, anio } = shiftMonth(filtros.mes, filtros.anio, n)
    setFiltros({ mes, anio })
  }

  // Sólo se ofrecen las categorías que todavía no tienen tope en el período.
  const disponibles = useMemo(() => {
    const conTope = new Set((data?.presupuestos ?? []).map(p => p.categoria_id))
    return categorias.filter(c => !conTope.has(c.id))
  }, [categorias, data])

  const totales = data?.totales

  return (
    <Box sx={{ pb: { xs: 6, sm: 8 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={700}>Presupuestos</Typography>
          <Typography variant="body2" color="text.secondary">
            Topes por categoría — excluye los resúmenes de tarjeta, cuyos consumos ya cuentan como gastos individuales
          </Typography>
        </Box>
        <IconButton size="small" onClick={() => navegar(-1)}><ChevronLeftIcon /></IconButton>
        <Typography fontWeight={600} sx={{ minWidth: 140, textAlign: 'center' }}>
          {MESES[filtros.mes - 1]} {filtros.anio}
        </Typography>
        <IconButton size="small" onClick={() => navegar(1)}><ChevronRightIcon /></IconButton>
      </Box>

      {totales && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          <Card variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">Presupuestado</Typography>
            <Typography variant="h6" fontWeight={700}>{fmtARS(totales.presupuestado)}</Typography>
          </Card>
          <Card variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">Gastado</Typography>
            <Typography variant="h6" fontWeight={700}>{fmtARS(totales.gastado)}</Typography>
            {totales.consumido_pct !== null && (
              <Typography variant="caption" color="text.secondary">
                {totales.consumido_pct.toLocaleString('es-AR', { maximumFractionDigits: 1 })}% del tope
              </Typography>
            )}
          </Card>
          <Card variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">Restante</Typography>
            <Typography variant="h6" fontWeight={700} sx={{ color: totales.restante < 0 ? COLOR.excedido : COLOR.ok }}>
              {fmtARS(totales.restante)}
            </Typography>
          </Card>
          <Card variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">Sin presupuesto</Typography>
            <Typography variant="h6" fontWeight={700}>{fmtARS(totales.sin_presupuesto)}</Typography>
            {totales.excedidas > 0 && (
              <Typography variant="caption" sx={{ color: COLOR.excedido, fontWeight: 600 }}>
                {totales.excedidas} categoría{totales.excedidas === 1 ? '' : 's'} excedida{totales.excedidas === 1 ? '' : 's'}
              </Typography>
            )}
          </Card>
        </Box>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>Fijar un tope</Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
            <AppSelect
              label="Categoría"
              options={disponibles.map(c => ({ value: c.id, label: c.nombre }))}
              value={nuevaCategoria}
              onChange={v => setNuevaCategoria(v == null ? null : Number(v))}
              sx={{ flex: 1 }}
            />
            <AppTextField
              label="Monto mensual"
              value={nuevoMonto}
              onChange={e => setNuevoMonto(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAgregar()}
              sx={{ flex: 1 }}
            />
            <Button variant="contained" onClick={handleAgregar} disabled={nuevaCategoria == null}>
              Guardar
            </Button>
          </Box>
          {disponibles.length === 0 && categorias.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Todas las categorías ya tienen presupuesto este mes.
            </Typography>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : !data || data.ejecucion.length === 0 ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No hay presupuestos ni gastos con categoría en {MESES[filtros.mes - 1]} {filtros.anio}.
          </Typography>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {data.ejecucion.map(f => (
            <FilaPresupuesto
              key={f.categoria_id}
              fila={f}
              onGuardar={monto => guardar(f.categoria_id, monto)}
              onBorrar={() => setABorrar(f)}
            />
          ))}
        </Box>
      )}

      <ConfirmDialog
        open={!!aBorrar}
        title="Quitar presupuesto"
        message={`¿Quitar el presupuesto de "${aBorrar?.categoria_nombre}"? La categoría deja de compararse contra un tope (no es lo mismo que ponerlo en 0).`}
        confirmLabel="Quitar"
        onCancel={() => setABorrar(null)}
        onConfirm={handleBorrar}
      />
    </Box>
  )
}

function FilaPresupuesto({
  fila, onGuardar, onBorrar,
}: {
  fila: EjecucionPresupuesto
  onGuardar: (monto: number) => Promise<boolean>
  onBorrar: () => void
}) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(String(fila.monto ?? ''))

  useEffect(() => { setValor(String(fila.monto ?? '')) }, [fila.monto])

  const guardar = async () => {
    const monto = Number(valor.replace(',', '.'))
    if (!Number.isFinite(monto) || monto < 0) { toast.error('Monto inválido'); return }
    if (await onGuardar(monto)) setEditando(false)
  }

  const color = COLOR[fila.estado]
  // La barra se corta en 100 aunque el consumo lo supere: el exceso se comunica con el
  // color y el monto en rojo, no estirando una barra fuera de su caja.
  const pct = Math.min(100, fila.consumido_pct ?? 0)

  return (
    <Card variant="outlined">
      <CardContent sx={{ pb: '16px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <Typography fontWeight={600} sx={{ flex: 1, minWidth: 120 }}>{fila.categoria_nombre}</Typography>

          {fila.monto === null ? (
            <Chip size="small" label="Sin presupuesto" variant="outlined" />
          ) : fila.estado === 'excedido' ? (
            <Chip size="small" label="Excedido" sx={{ bgcolor: `${COLOR.excedido}22`, color: COLOR.excedido, fontWeight: 600 }} />
          ) : fila.estado === 'cerca' ? (
            <Chip size="small" label="Cerca del tope" sx={{ bgcolor: `${COLOR.cerca}22`, color: COLOR.cerca, fontWeight: 600 }} />
          ) : null}

          {editando ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AppTextField
                size="small" autoFocus value={valor}
                onChange={e => setValor(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') setEditando(false) }}
                sx={{ width: 130 }}
              />
              <IconButton size="small" color="primary" onClick={guardar}><CheckIcon fontSize="small" /></IconButton>
            </Box>
          ) : (
            <Typography
              variant="body2"
              onClick={() => setEditando(true)}
              sx={{ cursor: 'pointer', textDecoration: 'underline dotted', color: 'text.secondary' }}
            >
              {fila.monto === null ? 'Fijar tope' : `Tope ${fmtARS(fila.monto)}`}
            </Typography>
          )}

          {fila.monto !== null && (
            <Tooltip title="Quitar presupuesto">
              <IconButton size="small" onClick={onBorrar}><DeleteIcon fontSize="small" /></IconButton>
            </Tooltip>
          )}
        </Box>

        <LinearProgress
          variant="determinate"
          value={fila.monto === null ? 0 : pct}
          sx={{ height: 8, borderRadius: 4, mb: 0.75, [`& .MuiLinearProgress-bar`]: { bgcolor: color } }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">
            Gastado <strong>{fmtARS(fila.gastado)}</strong>
            {fila.consumido_pct !== null && ` · ${fila.consumido_pct.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`}
          </Typography>
          {fila.restante !== null && (
            <Typography variant="caption" sx={{ color: fila.restante < 0 ? COLOR.excedido : 'text.secondary', fontWeight: 600 }}>
              {fila.restante < 0
                ? `${fmtARS(Math.abs(fila.restante))} de más`
                : `${fmtARS(fila.restante)} disponible`}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}
