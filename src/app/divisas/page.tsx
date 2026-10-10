'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { GridColDef } from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import toast from 'react-hot-toast'
import AppDataGrid from '@/components/shared/AppDataGrid'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import CotizacionesDialog from '@/components/divisas/CotizacionesDialog'
import EvolucionDivisaChart from '@/components/divisas/EvolucionDivisaChart'
import OperacionDivisaDialog from '@/components/divisas/OperacionDivisaDialog'
import ResumenDivisaCards from '@/components/divisas/ResumenDivisaCards'
import { colorResultado, fmtArs, fmtConSigno, fmtDivisa } from '@/components/divisas/formato'
import {
  computeOperaciones,
  cotizacionVigente,
  resumenDivisa,
  serieValorizada,
  type OperacionCalculada,
} from '@/lib/divisas-compute'
import type { CotizacionDivisa, Moneda, OperacionDivisa } from '@/lib/types'

/** Cómo se lee cada tipo en la grilla, y de qué color. */
const TIPO_CHIP: Record<string, { label: string; color: 'success' | 'error' | 'info' | 'warning' }> = {
  compra: { label: 'Compra', color: 'success' },
  venta: { label: 'Venta', color: 'error' },
  rendimiento: { label: 'Rendimiento', color: 'info' },
  egreso: { label: 'Egreso', color: 'warning' },
}

export default function DivisasPage() {
  const [monedas, setMonedas] = useState<Moneda[]>([])
  const [monedaId, setMonedaId] = useState<number | null>(null)
  const [operaciones, setOperaciones] = useState<OperacionDivisa[]>([])
  const [cotizaciones, setCotizaciones] = useState<CotizacionDivisa[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<OperacionDivisa | null>(null)
  const [cotDialogOpen, setCotDialogOpen] = useState(false)
  const [toDelete, setToDelete] = useState<OperacionDivisa | null>(null)

  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  // ARS no es una divisa acá: es la otra pata de toda operación.
  useEffect(() => {
    fetch('/api/monedas')
      .then((r) => r.json())
      .then((data: Moneda[]) => {
        const sinArs = data.filter((m) => m.codigo !== 'ARS')
        setMonedas(sinArs)
        setMonedaId((prev) => prev ?? sinArs.find((m) => m.codigo === 'USD')?.id ?? sinArs[0]?.id ?? null)
      })
      .catch(() => {})
  }, [])

  const load = useCallback(async (id: number) => {
    const [ops, cots] = await Promise.all([
      fetch(`/api/divisas/operaciones?moneda_id=${id}`).then((r) => r.json()),
      fetch(`/api/divisas/cotizaciones?moneda_id=${id}`).then((r) => r.json()),
    ])
    setOperaciones(ops)
    setCotizaciones(cots)
  }, [])

  useEffect(() => {
    if (monedaId !== null) load(monedaId)
  }, [monedaId, load])

  const moneda = monedas.find((m) => m.id === monedaId) ?? null
  const simbolo = moneda?.simbolo ?? 'US$'

  const ultimaCotizacion = useMemo(() => cotizacionVigente(cotizaciones), [cotizaciones])

  const resumen = useMemo(
    () => resumenDivisa(operaciones, ultimaCotizacion?.valor ?? null),
    [operaciones, ultimaCotizacion],
  )
  const serie = useMemo(() => serieValorizada(operaciones, cotizaciones), [operaciones, cotizaciones])

  /**
   * La corrida se calcula siempre en orden ascendente (cada fila mira la anterior) y recién
   * después se invierte para mostrar lo más reciente arriba — el mismo truco que inversiones:
   * el DataGrid free ordena por una sola columna, así que pre-reversear mantiene el desempate
   * por id dentro de la misma fecha.
   */
  const rows = useMemo(() => {
    const asc = computeOperaciones(operaciones).map((o) => ({ ...o, _raw: o as OperacionDivisa }))
    return asc.reverse()
  }, [operaciones])

  const plataformas = useMemo(
    () => Array.from(new Set(operaciones.map((o) => o.plataforma).filter((p): p is string => !!p))).sort(),
    [operaciones],
  )

  const onDelete = async () => {
    if (!toDelete) return
    try {
      const res = await fetch(`/api/divisas/operaciones/${toDelete.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Operación eliminada')
      setToDelete(null)
      if (monedaId !== null) await load(monedaId)
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const columns: GridColDef[] = [
    { field: 'fecha', headerName: 'Fecha', width: 110 },
    {
      field: 'tipo',
      headerName: 'Tipo',
      width: 130,
      renderCell: (params) => {
        const t = TIPO_CHIP[params.value as string]
        return <Chip size="small" label={t?.label ?? params.value} color={t?.color} variant="outlined" />
      },
    },
    {
      field: 'cantidad',
      headerName: `Cantidad (${simbolo})`,
      width: 140,
      type: 'number',
      valueFormatter: (value: number) => fmtDivisa(value, simbolo),
    },
    {
      field: 'cotizacion',
      headerName: 'Cotización',
      width: 130,
      type: 'number',
      renderCell: (params) =>
        params.value == null ? (
          <Typography variant="body2" color="text.disabled">—</Typography>
        ) : (
          <Typography variant="body2">{fmtArs(params.value as number)}</Typography>
        ),
    },
    {
      field: 'comision',
      headerName: 'Comisión',
      width: 120,
      type: 'number',
      renderCell: (params) => {
        const row = params.row as OperacionCalculada
        if (!row.comision) return <Typography variant="body2" color="text.disabled">—</Typography>
        return (
          <Typography variant="body2">
            {row.comision_moneda === 'DIVISA' ? fmtDivisa(row.comision, simbolo) : fmtArs(row.comision)}
          </Typography>
        )
      },
    },
    {
      field: 'cotizacion_efectiva',
      headerName: 'Efectiva',
      width: 130,
      type: 'number',
      renderCell: (params) =>
        params.value == null ? (
          <Typography variant="body2" color="text.disabled">—</Typography>
        ) : (
          <Tooltip title="Lo que realmente costó cada unidad con la comisión adentro">
            <Typography variant="body2" fontWeight={600}>{fmtArs(params.value as number)}</Typography>
          </Tooltip>
        ),
    },
    {
      field: 'ars_neto',
      headerName: 'Pesos',
      width: 150,
      type: 'number',
      renderCell: (params) => {
        const v = params.value as number
        if (v === 0) return <Typography variant="body2" color="text.disabled">—</Typography>
        return (
          <Typography variant="body2" sx={{ color: v > 0 ? 'success.main' : 'text.primary' }}>
            {fmtConSigno(v, fmtArs)}
          </Typography>
        )
      },
    },
    {
      field: 'resultado',
      headerName: 'Resultado',
      width: 150,
      type: 'number',
      renderCell: (params) => {
        const v = params.value as number | null
        if (v === null) return <Typography variant="body2" color="text.disabled">—</Typography>
        return (
          <Typography variant="body2" fontWeight={600} sx={{ color: colorResultado(v) }}>
            {fmtConSigno(v, fmtArs)}
          </Typography>
        )
      },
    },
    {
      field: 'tenencia',
      headerName: 'Tenencia',
      width: 140,
      type: 'number',
      valueFormatter: (value: number) => fmtDivisa(value, simbolo),
      cellClassName: () => 'cell-strong',
    },
    {
      field: 'costo_promedio',
      headerName: 'Costo prom.',
      width: 130,
      type: 'number',
      renderCell: (params) =>
        params.value == null ? (
          <Typography variant="body2" color="text.disabled">—</Typography>
        ) : (
          <Typography variant="body2">{fmtArs(params.value as number)}</Typography>
        ),
    },
    {
      field: 'plataforma',
      headerName: 'Plataforma',
      width: 140,
      renderCell: (params) =>
        params.value ? (
          <Typography variant="body2" noWrap>{params.value as string}</Typography>
        ) : (
          <Typography variant="body2" color="text.disabled">—</Typography>
        ),
    },
    {
      field: 'acciones',
      headerName: '',
      width: 100,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Editar">
            <IconButton
              size="small"
              onClick={() => {
                setEditando(params.row._raw)
                setDialogOpen(true)
              }}
            >
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

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight={700}>Divisas</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ShowChartIcon />}
            onClick={() => setCotDialogOpen(true)}
            disabled={monedaId === null}
          >
            {ultimaCotizacion ? fmtArs(ultimaCotizacion.valor) : 'Cotización'}
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditando(null)
              setDialogOpen(true)
            }}
            disabled={monedaId === null}
          >
            Operación
          </Button>
        </Box>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Compras y ventas de divisa con su cotización y comisión. No entran a Gastos ni a Ingresos:
        cambiar pesos por dólares no es consumo ni plata nueva.
      </Typography>

      {monedas.length > 1 && (
        <Tabs
          value={monedaId ?? false}
          onChange={(_, v) => setMonedaId(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 2, minHeight: 40, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          {monedas.map((m) => (
            <Tab key={m.id} label={m.codigo} value={m.id} sx={{ minHeight: 40, textTransform: 'none' }} />
          ))}
        </Tabs>
      )}

      <ResumenDivisaCards resumen={resumen} simbolo={simbolo} />

      {!ultimaCotizacion && operaciones.length > 0 && (
        <Card variant="outlined" sx={{ mb: 3, borderColor: 'warning.main' }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="body2">
              Cargá una cotización para poder valuar la tenencia en pesos y ver la ganancia.
            </Typography>
          </CardContent>
        </Card>
      )}

      <EvolucionDivisaChart serie={serie} />

      {operaciones.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Todavía no hay operaciones cargadas. Empezá con la primera compra usando el botón
              «Operación».
            </Typography>
          </CardContent>
        </Card>
      ) : isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {rows.map((row) => {
            const t = TIPO_CHIP[row.tipo]
            return (
              <Card key={row.id} variant="outlined">
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip size="small" label={t?.label ?? row.tipo} color={t?.color} variant="outlined" />
                        <Typography variant="body2" fontWeight={600}>{row.fecha}</Typography>
                      </Box>
                      <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5, fontSize: 18 }}>
                        {fmtDivisa(row.divisa_neta, simbolo)}
                      </Typography>
                      {row.plataforma && (
                        <Typography variant="caption" color="text.secondary">{row.plataforma}</Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', flexShrink: 0 }}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditando(row._raw)
                          setDialogOpen(true)
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => setToDelete(row._raw)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Pesos</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {row.ars_neto === 0 ? '—' : fmtConSigno(row.ars_neto, fmtArs)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Cotización efectiva</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {row.cotizacion_efectiva === null ? '—' : fmtArs(row.cotizacion_efectiva)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Resultado</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: colorResultado(row.resultado) }}>
                        {row.resultado === null ? '—' : fmtConSigno(row.resultado, fmtArs)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Tenencia</Typography>
                      <Typography variant="body2" fontWeight={700}>{fmtDivisa(row.tenencia, simbolo)}</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            )
          })}
        </Box>
      ) : (
        <Box sx={{ height: 560, width: '100%', '& .cell-strong': { fontWeight: 600 } }}>
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

      {monedaId !== null && (
        <>
          <OperacionDivisaDialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            onSaved={() => load(monedaId)}
            monedaId={monedaId}
            simbolo={simbolo}
            operaciones={operaciones}
            editando={editando}
            cotizacionSugerida={ultimaCotizacion?.valor ?? null}
            plataformas={plataformas}
          />
          <CotizacionesDialog
            open={cotDialogOpen}
            onClose={() => setCotDialogOpen(false)}
            onChanged={() => load(monedaId)}
            monedaId={monedaId}
            codigo={moneda?.codigo ?? ''}
            cotizaciones={cotizaciones}
          />
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar operación"
        message={
          toDelete
            ? `¿Eliminar la operación del ${toDelete.fecha}? La tenencia y el costo de todo lo posterior se recalculan.`
            : ''
        }
        onConfirm={onDelete}
        onCancel={() => setToDelete(null)}
      />
    </Box>
  )
}
