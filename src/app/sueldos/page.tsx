'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import TextField from '@/components/shared/AppTextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
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
import { calcularSueldo, alcanzaTeorico, emailPuedeVerSueldos } from '@/lib/sueldos-compute'
import type { Sueldo } from '@/lib/types'


function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function SueldosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [sueldos, setSueldos] = useState<Sueldo[]>([])
  const [fecha, setFecha] = useState(todayLocal())
  const [sueldoTeorico, setSueldoTeorico] = useState('')
  const [sueldoArs, setSueldoArs] = useState('')
  const [sueldoUsd, setSueldoUsd] = useState('')
  const [cotBna, setCotBna] = useState('')
  const [cotMep, setCotMep] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [toDelete, setToDelete] = useState<Sueldo | null>(null)
  const [saving, setSaving] = useState(false)

  const isAllowed = emailPuedeVerSueldos(session?.user?.email)

  useEffect(() => {
    if (status === 'authenticated' && !isAllowed) router.replace('/gastos')
  }, [status, isAllowed, router])

  const load = async () => {
    const res = await fetch('/api/sueldos')
    if (!res.ok) return
    const data: Sueldo[] = await res.json()
    setSueldos(data)
  }

  useEffect(() => {
    if (isAllowed) load()
  }, [isAllowed])

  const resetForm = () => {
    setFecha(todayLocal())
    setSueldoTeorico('')
    setSueldoArs('')
    setSueldoUsd('')
    setCotBna('')
    setCotMep('')
    setEditingId(null)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fecha) {
      toast.error('Completá la fecha')
      return
    }
    const body = {
      fecha,
      sueldo_teorico: sueldoTeorico === '' ? 0 : Number(sueldoTeorico),
      sueldo_ars: sueldoArs === '' ? 0 : Number(sueldoArs),
      sueldo_usd: sueldoUsd === '' ? 0 : Number(sueldoUsd),
      cotizacion_bna: cotBna === '' ? 0 : Number(cotBna),
      cotizacion_mep: cotMep === '' ? 0 : Number(cotMep),
    }
    setSaving(true)
    try {
      const url = editingId ? `/api/sueldos/${editingId}` : '/api/sueldos'
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success(editingId ? 'Sueldo actualizado' : 'Sueldo agregado')
      resetForm()
      await load()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const onEdit = (s: Sueldo) => {
    setEditingId(s.id)
    setFecha(s.fecha)
    setSueldoTeorico(String(s.sueldo_teorico))
    setSueldoArs(String(s.sueldo_ars))
    setSueldoUsd(String(s.sueldo_usd))
    setCotBna(String(s.cotizacion_bna))
    setCotMep(String(s.cotizacion_mep))
  }

  const onDelete = async () => {
    if (!toDelete) return
    try {
      await fetch(`/api/sueldos/${toDelete.id}`, { method: 'DELETE' })
      toast.success('Sueldo eliminado')
      if (editingId === toDelete.id) resetForm()
      setToDelete(null)
      await load()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const rows = useMemo(() => {
    return sueldos.map((s) => {
      const { neto, bruto } = calcularSueldo(s)
      return { ...s, neto, bruto, _raw: s }
    })
  }, [sueldos])

  // `alcanzaTeorico` devuelve null sin teórico cargado: ahí no hay nada que comparar y el
  // monto va en el color de texto normal, en vez de pintarse de rojo por defecto.
  const brutoColor = (row: Sueldo) => {
    const ok = alcanzaTeorico(row)
    return ok === null ? 'text.primary' : ok ? 'success.main' : 'error.main'
  }

  const columns: GridColDef[] = [
    { field: 'fecha', headerName: 'Fecha', width: 130 },
    { field: 'sueldo_teorico', headerName: 'Sueldo teórico', width: 150, type: 'number', valueFormatter: (v: number) => fmtARS(v) },
    { field: 'sueldo_ars', headerName: 'Pagado ARS', width: 150, type: 'number', valueFormatter: (v: number) => fmtARS(v) },
    { field: 'sueldo_usd', headerName: 'Pagado USD', width: 130, type: 'number', valueFormatter: (v: number) => v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
    { field: 'cotizacion_bna', headerName: 'Cot. BNA', width: 110, type: 'number', valueFormatter: (v: number) => v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
    { field: 'cotizacion_mep', headerName: 'Cot. MEP', width: 110, type: 'number', valueFormatter: (v: number) => v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
    {
      field: 'neto',
      headerName: 'Neto',
      width: 160,
      type: 'number',
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{fmtARS(params.value as number)}</Typography>
      ),
    },
    {
      field: 'bruto',
      headerName: 'Bruto',
      width: 160,
      type: 'number',
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 700, color: brutoColor(params.row) }}>
          {fmtARS(params.value as number)}
        </Typography>
      ),
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

  if (status === 'loading') return null
  if (!isAllowed) return null

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>Sueldos</Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {editingId ? 'Editar sueldo' : 'Nuevo sueldo'}
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
            <AppDateField label="Fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} size="small" sx={{ minWidth: { xs: 'auto', sm: 160 } }} />
            <TextField label="Sueldo teórico" type="number" value={sueldoTeorico} onChange={(e) => setSueldoTeorico(e.target.value)} size="small" inputProps={{ step: '0.01' }} sx={{ minWidth: { xs: 'auto', sm: 160 } }} />
            <TextField label="Pagado ARS" type="number" value={sueldoArs} onChange={(e) => setSueldoArs(e.target.value)} size="small" inputProps={{ step: '0.01' }} sx={{ minWidth: { xs: 'auto', sm: 160 } }} />
            <TextField label="Pagado USD" type="number" value={sueldoUsd} onChange={(e) => setSueldoUsd(e.target.value)} size="small" inputProps={{ step: '0.01' }} sx={{ minWidth: { xs: 'auto', sm: 140 } }} />
            <TextField label="Cot. BNA" type="number" value={cotBna} onChange={(e) => setCotBna(e.target.value)} size="small" inputProps={{ step: '0.01' }} sx={{ minWidth: { xs: 'auto', sm: 130 } }} />
            <TextField label="Cot. MEP" type="number" value={cotMep} onChange={(e) => setCotMep(e.target.value)} size="small" inputProps={{ step: '0.01' }} sx={{ minWidth: { xs: 'auto', sm: 130 } }} />
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
                <Typography variant="body2" color="text.secondary">No hay sueldos cargados aún.</Typography>
              </CardContent>
            </Card>
          ) : (
            rows.map((row) => {
              const color = brutoColor(row)
              return (
                <Card key={row.id} variant="outlined">
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                      <Typography variant="body2" fontWeight={600}>{row.fecha}</Typography>
                      <Box sx={{ display: 'flex' }}>
                        <IconButton size="small" onClick={() => onEdit(row._raw)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" onClick={() => setToDelete(row._raw)}><DeleteIcon fontSize="small" /></IconButton>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Teórico</Typography>
                        <Typography variant="body2" fontWeight={600}>{fmtARS(row.sueldo_teorico)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>ARS</Typography>
                        <Typography variant="body2" fontWeight={600}>{fmtARS(row.sueldo_ars)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>USD</Typography>
                        <Typography variant="body2" fontWeight={600}>{row.sueldo_usd.toFixed(2)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>MEP / BNA</Typography>
                        <Typography variant="body2" fontWeight={600}>{row.cotizacion_mep.toFixed(2)} / {row.cotizacion_bna.toFixed(2)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Neto</Typography>
                        <Typography variant="body2" fontWeight={700}>{fmtARS(row.neto)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Bruto</Typography>
                        <Typography variant="body2" fontWeight={700} sx={{ color }}>{fmtARS(row.bruto)}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              )
            })
          )}
        </Box>
      ) : (
        <Box sx={{ height: 560, width: '100%' }}>
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

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar sueldo"
        message={toDelete ? `¿Eliminar el sueldo del ${toDelete.fecha}?` : ''}
        onConfirm={onDelete}
        onCancel={() => setToDelete(null)}
      />
    </Box>
  )
}
