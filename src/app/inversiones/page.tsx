'use client'

import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import TextField from '@/components/shared/AppTextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import { GridColDef } from '@mui/x-data-grid'
import AppDataGrid from '@/components/shared/AppDataGrid'
import AppDateField from '@/components/shared/AppDateField'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CloseIcon from '@mui/icons-material/Close'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { computeMovimientos, resumenInversion, serieEvolucion } from '@/lib/inversiones-compute'
import ResumenInversionCards from '@/components/inversiones/ResumenInversionCards'
import EvolucionInversionChart from '@/components/inversiones/EvolucionInversionChart'
import AppSelect from '@/components/shared/AppSelect'
import type { Inversion, Movimiento, Moneda } from '@/lib/types'

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function InversionesPage() {
  const [inversiones, setInversiones] = useState<Inversion[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])

  const [fecha, setFecha] = useState(todayLocal())
  const [montoActual, setMontoActual] = useState('')
  const [movimientoMonto, setMovimientoMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [toDelete, setToDelete] = useState<Movimiento | null>(null)
  const [saving, setSaving] = useState(false)

  const [invDialogOpen, setInvDialogOpen] = useState(false)
  const [invMonedaId, setInvMonedaId] = useState<number | null>(null)
  const [monedas, setMonedas] = useState<Moneda[]>([])
  const [invDialogMode, setInvDialogMode] = useState<'create' | 'edit'>('create')
  const [invName, setInvName] = useState('')
  const [invToDelete, setInvToDelete] = useState<Inversion | null>(null)

  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const loadInversiones = async () => {
    const data: Inversion[] = await fetch('/api/inversiones').then(r => r.json())
    setInversiones(data)
    if (data.length > 0 && (activeId === null || !data.find(i => i.id === activeId))) {
      setActiveId(data[0].id)
    } else if (data.length === 0) {
      setActiveId(null)
      setMovimientos([])
    }
  }

  const loadMovimientos = async (invId: number) => {
    const data: Movimiento[] = await fetch(`/api/inversiones/${invId}/movimientos`).then(r => r.json())
    setMovimientos(data)
  }

  useEffect(() => { loadInversiones() }, [])
  // Las monedas son para el select del alta/edición de la inversión.
  useEffect(() => { fetch('/api/monedas').then(r => r.json()).then(setMonedas).catch(() => {}) }, [])
  useEffect(() => { if (activeId !== null) loadMovimientos(activeId) }, [activeId])

  const resetForm = () => {
    setFecha(todayLocal())
    setMontoActual('')
    setMovimientoMonto('')
    setDescripcion('')
    setEditingId(null)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (activeId === null) {
      toast.error('Creá una inversión primero')
      return
    }
    if (!fecha) {
      toast.error('Completá la fecha')
      return
    }
    if (montoActual === '' && movimientoMonto === '') {
      toast.error('Completá Monto actual o Movimiento')
      return
    }
    let montoActualResolved: number
    if (montoActual === '') {
      const lastByDate = [...movimientos]
        .filter(m => !editingId || m.id !== editingId)
        .sort((a, b) => {
          if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha)
          return b.id - a.id
        })[0]
      if (!lastByDate) {
        toast.error('No hay movimientos previos: cargá un Monto actual')
        return
      }
      montoActualResolved = lastByDate.monto_actual
    } else {
      montoActualResolved = Number(montoActual)
    }
    const body = {
      fecha,
      monto_actual: montoActualResolved,
      movimiento: movimientoMonto === '' ? 0 : Number(movimientoMonto),
      // El trim y el "vacío → null" los hace la route (`parseDescripcionMovimiento`).
      descripcion,
    }
    setSaving(true)
    try {
      const url = editingId
        ? `/api/inversiones/${activeId}/movimientos/${editingId}`
        : `/api/inversiones/${activeId}/movimientos`
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success(editingId ? 'Movimiento actualizado' : 'Movimiento agregado')
      resetForm()
      await loadMovimientos(activeId)
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const onEdit = (mov: Movimiento) => {
    setEditingId(mov.id)
    setFecha(mov.fecha)
    setMontoActual(String(mov.monto_actual))
    setMovimientoMonto(String(mov.movimiento))
    setDescripcion(mov.descripcion ?? '')
  }

  const onDeleteMov = async () => {
    if (!toDelete || activeId === null) return
    try {
      await fetch(`/api/inversiones/${activeId}/movimientos/${toDelete.id}`, { method: 'DELETE' })
      toast.success('Movimiento eliminado')
      if (editingId === toDelete.id) resetForm()
      setToDelete(null)
      await loadMovimientos(activeId)
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const openCreateInversion = () => {
    setInvDialogMode('create')
    setInvName('')
    setInvMonedaId(null)
    setInvDialogOpen(true)
  }

  const openEditInversion = () => {
    const inv = inversiones.find(i => i.id === activeId)
    if (!inv) return
    setInvDialogMode('edit')
    setInvName(inv.nombre)
    setInvMonedaId(inv.moneda_id)
    setInvDialogOpen(true)
  }

  const submitInversion = async () => {
    if (!invName.trim()) { toast.error('Ingresá un nombre'); return }
    try {
      if (invDialogMode === 'create') {
        const res = await fetch('/api/inversiones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: invName.trim(), moneda_id: invMonedaId }),
        })
        if (!res.ok) throw new Error()
        const created: Inversion = await res.json()
        toast.success('Inversión creada')
        setInvDialogOpen(false)
        await loadInversiones()
        setActiveId(created.id)
      } else if (activeId !== null) {
        const res = await fetch(`/api/inversiones/${activeId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: invName.trim(), moneda_id: invMonedaId }),
        })
        if (!res.ok) throw new Error()
        toast.success('Inversión actualizada')
        setInvDialogOpen(false)
        await loadInversiones()
      }
    } catch {
      toast.error('Error al guardar')
    }
  }

  const onDeleteInversion = async () => {
    if (!invToDelete) return
    try {
      const res = await fetch(`/api/inversiones/${invToDelete.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Inversión eliminada')
      setInvToDelete(null)
      if (activeId === invToDelete.id) setActiveId(null)
      await loadInversiones()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  // El cálculo vive en `inversiones-compute` (puro y testeado); acá sólo se ordena.
  // `computeMovimientos` espera orden cronológico ascendente: cada fila mira la anterior.
  const ordenados = useMemo(() => {
    return [...movimientos].sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha)
      return a.id - b.id
    })
  }, [movimientos])

  const resumen = useMemo(() => resumenInversion(ordenados), [ordenados])
  const serie = useMemo(() => serieEvolucion(ordenados), [ordenados])

  const rows = useMemo(() => {
    const ascRows = computeMovimientos(ordenados).map((mov) => ({
      id: mov.id,
      fecha: mov.fecha,
      monto_actual: mov.monto_actual,
      movimiento: mov.movimiento,
      descripcion: mov.descripcion ?? '',
      monto_actualizado: mov.monto_actualizado,
      cambio: mov.cambio,
      ganancia: mov.ganancia,
      rendimiento_pct: mov.rendimiento_pct,
      _raw: mov,
    }))
    // El DataGrid free ordena por una sola columna: pre-reversear mantiene el desempate
    // por id descendente dentro de la misma fecha.
    return ascRows.reverse()
  }, [ordenados])

  const columns: GridColDef[] = [
    { field: 'fecha', headerName: 'Fecha', width: 130 },
    {
      field: 'dia',
      headerName: 'Día',
      width: 120,
      valueGetter: (_value, row) => {
        const f = row.fecha as string
        if (!f) return ''
        const [y, m, d] = f.split('-').map(Number)
        const date = new Date(y, m - 1, d)
        const name = date.toLocaleDateString('es-AR', { weekday: 'long' })
        return name.charAt(0).toUpperCase() + name.slice(1)
      },
    },
    { field: 'monto_actual', headerName: 'Monto actual', width: 160, type: 'number', valueFormatter: (value: number) => fmtARS(value) },
    { field: 'movimiento', headerName: 'Movimiento', width: 160, type: 'number', valueFormatter: (value: number) => fmtARS(value) },
    {
      field: 'descripcion',
      headerName: 'Descripción',
      width: 220,
      renderCell: (params) => {
        const v = params.value as string
        if (!v) return <Typography variant="body2" color="text.disabled">—</Typography>
        return (
          <Tooltip title={v}>
            <Typography variant="body2" noWrap>{v}</Typography>
          </Tooltip>
        )
      },
    },
    {
      field: 'monto_actualizado',
      headerName: 'Monto actualizado',
      width: 180,
      type: 'number',
      valueFormatter: (value: number) => fmtARS(value),
      cellClassName: () => 'cell-strong',
    },
    {
      field: 'cambio',
      headerName: 'Cambio',
      width: 160,
      type: 'number',
      renderCell: (params) => {
        const v = params.value as number | null
        if (v === null) return <Typography variant="body2" color="text.disabled">—</Typography>
        const color = v > 0 ? 'success.main' : v < 0 ? 'error.main' : 'text.secondary'
        const sign = v > 0 ? '+' : ''
        return <Typography variant="body2" sx={{ color, fontWeight: 600 }}>{sign}{fmtARS(v)}</Typography>
      },
    },
    {
      field: 'acciones',
      headerName: '',
      width: 110,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => onEdit(params.row._raw)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton size="small" onClick={() => setToDelete(params.row._raw)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ]

  const activeInversion = inversiones.find(i => i.id === activeId) || null
  // Sin moneda declarada se muestra `$`: es lo que se venía asumiendo antes de que la
  // inversión tuviera moneda.
  const simboloMoneda = activeInversion?.moneda_simbolo ?? '$'

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>Inversiones</Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tabs
          value={activeId ?? false}
          onChange={(_, v) => setActiveId(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ flexGrow: 1, minHeight: 40 }}
        >
          {inversiones.map(inv => (
            <Tab key={inv.id} label={inv.nombre} value={inv.id} sx={{ minHeight: 40, textTransform: 'none' }} />
          ))}
        </Tabs>
        {activeInversion && (
          <>
            <Tooltip title="Renombrar inversión">
              <IconButton size="small" onClick={openEditInversion}><EditIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Eliminar inversión">
              <IconButton size="small" onClick={() => setInvToDelete(activeInversion)}><DeleteIcon fontSize="small" /></IconButton>
            </Tooltip>
          </>
        )}
        <Tooltip title="Nueva inversión">
          <IconButton size="small" color="primary" onClick={openCreateInversion}><AddIcon /></IconButton>
        </Tooltip>
      </Box>

      {activeId === null ? (
        <Card><CardContent>
          <Typography variant="body2" color="text.secondary">
            No hay inversiones. Creá una con el botón + arriba.
          </Typography>
        </CardContent></Card>
      ) : (
        <>
          <ResumenInversionCards resumen={resumen} simbolo={simboloMoneda} />
          <EvolucionInversionChart serie={serie} simbolo={simboloMoneda} />

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {editingId ? 'Editar movimiento' : 'Nuevo movimiento'}
                </Typography>
                {editingId && (
                  <Button size="small" startIcon={<CloseIcon />} onClick={resetForm}>Cancelar</Button>
                )}
              </Box>
              <Box
                component="form"
                onSubmit={onSubmit}
                sx={{
                  display: 'flex',
                  gap: { xs: 1.5, sm: 2 },
                  flexWrap: { xs: 'nowrap', sm: 'wrap' },
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'stretch', sm: 'flex-end' },
                }}
              >
                <AppDateField label="Fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} size="small" sx={{ minWidth: { xs: 'auto', sm: 170 } }} />
                <TextField label="Monto actual" type="number" value={montoActual} onChange={(e) => setMontoActual(e.target.value)} size="small" inputProps={{ step: '0.01' }} sx={{ minWidth: { xs: 'auto', sm: 180 } }} />
                <TextField label="Movimiento" type="number" value={movimientoMonto} onChange={(e) => setMovimientoMonto(e.target.value)} size="small" inputProps={{ step: '0.01' }} sx={{ minWidth: { xs: 'auto', sm: 180 } }} />
                <TextField
                  label="Descripción"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  size="small"
                  placeholder="Por qué se cargó (opcional)"
                  sx={{ minWidth: { xs: 'auto', sm: 240 }, flexGrow: { sm: 1 } }}
                />
                <Button type="submit" variant="contained" startIcon={<AddIcon />} disabled={saving}>
                  {editingId ? 'Guardar' : 'Agregar'}
                </Button>
              </Box>
            </CardContent>
          </Card>

          {isMobile ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {rows.length === 0 ? (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      No hay movimientos cargados aún.
                    </Typography>
                  </CardContent>
                </Card>
              ) : (
                rows.map((row) => {
                  const cambio = row.cambio
                  const cambioColor = cambio == null ? 'text.disabled' : cambio > 0 ? 'success.main' : cambio < 0 ? 'error.main' : 'text.secondary'
                  const sign = cambio == null ? '' : cambio > 0 ? '+' : ''
                  const [y, m, d] = row.fecha.split('-').map(Number)
                  const dayName = new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long' })
                  return (
                    <Card key={row.id} variant="outlined">
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600}>{row.fecha}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{dayName}</Typography>
                            {row.descripcion && (
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{row.descripcion}</Typography>
                            )}
                          </Box>
                          <Box sx={{ display: 'flex' }}>
                            <IconButton size="small" onClick={() => onEdit(row._raw)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" onClick={() => setToDelete(row._raw)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Monto actual</Typography>
                            <Typography variant="body2" fontWeight={600}>{fmtARS(row.monto_actual)}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Movimiento</Typography>
                            <Typography variant="body2" fontWeight={600}>{fmtARS(row.movimiento)}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Actualizado</Typography>
                            <Typography variant="body2" fontWeight={700}>{fmtARS(row.monto_actualizado)}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Cambio</Typography>
                            <Typography variant="body2" fontWeight={600} sx={{ color: cambioColor }}>
                              {cambio == null ? '—' : `${sign}${fmtARS(cambio)}`}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </Box>
          ) : (
            <Box sx={{ height: 560, width: '100%', '& .cell-strong': { fontWeight: 600 } }}>
              <AppDataGrid
                rows={rows}
                columns={columns}
                initialState={{ sorting: { sortModel: [{ field: 'fecha', sort: 'desc' }] } }}
                onDeleteKeyPress={(id) => {
                  const row = rows.find(r => r.id === id)
                  if (row) setToDelete(row._raw)
                }}
              />
            </Box>
          )}
        </>
      )}

      <Dialog open={invDialogOpen} onClose={() => setInvDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>{invDialogMode === 'create' ? 'Nueva inversión' : 'Editar inversión'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Nombre"
            value={invName}
            onChange={(e) => setInvName(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
            onKeyDown={(e) => { if (e.key === 'Enter') submitInversion() }}
          />
          <AppSelect
            label="Moneda"
            options={monedas.map(m => ({ value: m.id, label: `${m.codigo} — ${m.nombre}` }))}
            value={invMonedaId}
            onChange={(v) => setInvMonedaId(v == null ? null : Number(v))}
            emptyLabel="Sin especificar (pesos)"
            fullWidth
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Los montos se siguen en esta moneda; no se convierten a pesos. Convertir mezclaría
            la variación del tipo de cambio con el rendimiento real.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setInvDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={submitInversion}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar movimiento"
        message={toDelete ? `¿Eliminar el movimiento del ${toDelete.fecha}?` : ''}
        onConfirm={onDeleteMov}
        onCancel={() => setToDelete(null)}
      />

      <ConfirmDialog
        open={!!invToDelete}
        title="Eliminar inversión"
        message={invToDelete ? `¿Eliminar la inversión "${invToDelete.nombre}" y todos sus movimientos?` : ''}
        onConfirm={onDeleteInversion}
        onCancel={() => setInvToDelete(null)}
      />
    </Box>
  )
}
