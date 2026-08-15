'use client'

import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Grid from '@mui/material/Grid'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { GridColDef } from '@mui/x-data-grid'
import AppDataGrid from '@/components/shared/AppDataGrid'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import IngresoForm from '@/components/ingresos/IngresoForm'
import { useIngresos, type IngresoInput } from '@/components/ingresos/useIngresos'
import { useGastosStore } from '@/store/gastosStore'
import type { Casa, Ingreso, Moneda, Resumen } from '@/lib/types'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

export default function IngresosPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  // Comparte el mes/casa con el dashboard de gastos: moverse acá deja Gastos en el mismo mes.
  const { filtros, setFiltros, triggerResumenRefresh } = useGastosStore()
  const { mes, anio, casa_id } = filtros

  const { ingresos, total, guardar, eliminar, saving } = useIngresos(mes, anio, casa_id)
  const [casas, setCasas] = useState<Casa[]>([])
  const [monedas, setMonedas] = useState<Moneda[]>([])
  const [editing, setEditing] = useState<Ingreso | null>(null)
  const [toDelete, setToDelete] = useState<Ingreso | null>(null)
  const [debito, setDebito] = useState(0)

  useEffect(() => {
    fetch('/api/casas').then((r) => r.json()).then(setCasas).catch(() => setCasas([]))
    fetch('/api/monedas').then((r) => r.json()).then(setMonedas).catch(() => setMonedas([]))
  }, [])

  // Lo gastado en débito/efectivo sale del mismo resumen que alimenta las cards de Gastos.
  useEffect(() => {
    const params = new URLSearchParams({
      mes: String(mes),
      anio: String(anio),
      ...(casa_id ? { casa_id: String(casa_id) } : {}),
    })
    fetch(`/api/resumen?${params}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((r: Resumen) => setDebito(r.total_debito))
      .catch(() => setDebito(0))
  }, [mes, anio, casa_id, ingresos])

  const prevMes = () => {
    if (mes === 1) setFiltros({ mes: 12, anio: anio - 1 })
    else setFiltros({ mes: mes - 1 })
    setEditing(null)
  }

  const nextMes = () => {
    if (mes === 12) setFiltros({ mes: 1, anio: anio + 1 })
    else setFiltros({ mes: mes + 1 })
    setEditing(null)
  }

  const onSubmit = async (input: IngresoInput, id?: number) => {
    const ok = await guardar(input, id)
    if (ok) triggerResumenRefresh()
    return ok
  }

  const onDelete = async () => {
    if (!toDelete) return
    const ok = await eliminar(toDelete.id)
    if (ok) {
      triggerResumenRefresh()
      if (editing?.id === toDelete.id) setEditing(null)
    }
    setToDelete(null)
  }

  const ahorro = total - debito
  const ahorroPct = total === 0 ? 0 : (ahorro / total) * 100
  const ahorroColor = ahorro < 0 ? 'error.main' : 'success.main'

  const rows = useMemo(() => ingresos.map((i) => ({ ...i, _raw: i })), [ingresos])

  const columns: GridColDef[] = [
    { field: 'fecha', headerName: 'Fecha', width: 130 },
    { field: 'descripcion', headerName: 'Descripción', flex: 1, minWidth: 180, valueGetter: (v: string | null) => v ?? '—' },
    { field: 'casa_nombre', headerName: 'Casa', width: 140, valueGetter: (v: string | null) => v ?? 'General' },
    {
      field: 'monto_moneda',
      headerName: 'Monto',
      width: 150,
      type: 'number',
      renderCell: (params) => {
        const row = params.row as Ingreso
        return (
          <Typography variant="body2">
            {row.moneda_simbolo ?? ''}{(params.value as number).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {row.moneda_codigo && row.moneda_codigo !== 'ARS' ? ` ${row.moneda_codigo}` : ''}
          </Typography>
        )
      },
    },
    {
      field: 'tipo_cambio',
      headerName: 'T. Cambio',
      width: 110,
      type: 'number',
      // En ARS no hay conversión: mostrar "1" en cada fila sería ruido.
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {(params.row as Ingreso).moneda_codigo === 'ARS' ? '—' : (params.value as number).toLocaleString('es-AR')}
        </Typography>
      ),
    },
    {
      field: 'monto_ars',
      headerName: 'En ARS',
      width: 160,
      type: 'number',
      renderCell: (params) => (
        <Typography variant="body2" fontWeight={700} color="success.main">{fmtARS(params.value as number)}</Typography>
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
            <IconButton size="small" onClick={() => setEditing(params.row._raw)}>
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

  const KPIS = [
    { label: 'Ingresado', value: fmtARS(total), color: 'success.main' as const, hint: `${ingresos.length} ingreso(s) cargado(s)` },
    { label: 'Gastado en débito', value: fmtARS(debito), color: 'warning.main' as const, hint: 'Débito/efectivo + resúmenes de tarjeta' },
    {
      label: 'Ahorrado',
      value: total === 0 ? '—' : fmtARS(ahorro),
      color: total === 0 ? 'text.secondary' as const : ahorroColor,
      hint: total === 0 ? 'Cargá los ingresos del mes' : `${ahorroPct.toLocaleString('es-AR', { maximumFractionDigits: 1 })}% de lo ingresado`,
    },
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Ingresos</Typography>
          <Typography variant="body2" color="text.secondary">{MESES[mes - 1]} {anio}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton size="small" onClick={prevMes}><ChevronLeftIcon /></IconButton>
          <Typography variant="body1" fontWeight={600} sx={{ minWidth: 150, textAlign: 'center' }}>
            {MESES[mes - 1]} {anio}
          </Typography>
          <IconButton size="small" onClick={nextMes}><ChevronRightIcon /></IconButton>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {KPIS.map((k) => (
          <Grid item xs={12} sm={4} key={k.label}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent sx={{ pb: '16px !important' }}>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>{k.label}</Typography>
                <Typography variant="h6" fontWeight={700} sx={{ color: k.color }}>{k.value}</Typography>
                <Typography variant="caption" color="text.secondary">{k.hint}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            {editing ? 'Editar ingreso' : 'Nuevo ingreso'}
          </Typography>
          <IngresoForm
            mes={mes}
            anio={anio}
            casas={casas}
            monedas={monedas}
            editing={editing}
            onSubmit={onSubmit}
            onCancelEdit={() => setEditing(null)}
            saving={saving}
          />
        </CardContent>
      </Card>

      {isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {rows.length === 0 ? (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary">No hay ingresos cargados para este mes.</Typography>
              </CardContent>
            </Card>
          ) : (
            rows.map((row) => (
              <Card key={row.id} variant="outlined">
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} color="success.main">{fmtARS(row.monto_ars)}</Typography>
                      {/* El monto original sólo se repite si no era ARS — si no, sería ruido. */}
                      {row.moneda_codigo && row.moneda_codigo !== 'ARS' && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {row.moneda_simbolo ?? ''}{row.monto_moneda.toLocaleString('es-AR')} {row.moneda_codigo} @ {row.tipo_cambio}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {row.fecha}{row.descripcion ? ` · ${row.descripcion}` : ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {row.casa_nombre ?? 'General'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexShrink: 0 }}>
                      <IconButton size="small" onClick={() => setEditing(row._raw)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" onClick={() => setToDelete(row._raw)}><DeleteIcon fontSize="small" /></IconButton>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Box>
      ) : (
        <Box sx={{ height: 520, width: '100%' }}>
          <AppDataGrid
            rows={rows}
            columns={columns}
            initialState={{ sorting: { sortModel: [{ field: 'fecha', sort: 'desc' }] } }}
            onDeleteKeyPress={(id) => {
              const row = rows.find((r) => r.id === id)
              if (row) setToDelete(row._raw)
            }}
          />
        </Box>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar ingreso"
        message={toDelete ? `¿Eliminar el ingreso de ${fmtARS(toDelete.monto_ars)} del ${toDelete.fecha}?` : ''}
        onConfirm={onDelete}
        onCancel={() => setToDelete(null)}
      />
    </Box>
  )
}
