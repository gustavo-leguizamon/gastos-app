'use client'

import { useEffect, useState } from 'react'
import { GridColDef, GridSortModel } from '@mui/x-data-grid'
import AppDataGrid from '@/components/shared/AppDataGrid'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Switch from '@mui/material/Switch'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import HomeIcon from '@mui/icons-material/Home'
import PaymentsIcon from '@mui/icons-material/Payments'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ViewListIcon from '@mui/icons-material/ViewList'
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import BrandLogo from '@/components/shared/BrandLogo'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import toast from 'react-hot-toast'
import { useGastosStore } from '@/store/gastosStore'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import PagoDialog from './PagoDialog'
import GastoItemDialog from './GastoItemDialog'
import CopiarGastoDialog from './CopiarGastoDialog'
import type { Gasto, FiltrosGastos } from '@/lib/types'

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

function fmtNum(n: number, simbolo: string) {
  return `${simbolo} ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)}`
}

interface Props {
  filtros: FiltrosGastos
  refreshKey: number
  estadoPago: 'todos' | 'pendiente' | 'saldado'
  busqueda: string
  onEdit: (gasto: Gasto) => void
  onDeleted: () => void
}

export default function GastosTable({ filtros, refreshKey, estadoPago, busqueda, onEdit, onDeleted }: Props) {
  const triggerResumenRefresh = useGastosStore(s => s.triggerResumenRefresh)
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [loading, setLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [pagoGasto, setPagoGasto] = useState<Gasto | null>(null)
  const [itemGasto, setItemGasto] = useState<Gasto | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [copiarGasto, setCopiarGasto] = useState<Gasto | null>(null)
  const [selectedGastoId, setSelectedGastoId] = useState<number | null>(null)
  const [sortModel, setSortModel] = useState<GridSortModel>([])

  const sortGastos = (rows: Gasto[]) => {
    if (sortModel.length === 0) return rows
    const { field, sort } = sortModel[0]
    if (!sort) return rows
    const sign = sort === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = (a as any)[field]
      const vb = (b as any)[field]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sign
      return String(va).localeCompare(String(vb)) * sign
    })
  }
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; gasto: Gasto } | null>(null)

  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const loadGastos = () => {
    setLoading(true)
    const params = new URLSearchParams({
      mes: String(filtros.mes),
      anio: String(filtros.anio),
      ...(filtros.casa_id ? { casa_id: String(filtros.casa_id) } : {}),
      ...(filtros.tipo_pago ? { tipo_pago: filtros.tipo_pago } : {}),
    })
    fetch(`/api/gastos?${params}`)
      .then(r => r.json())
      .then(data => setGastos(data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadGastos() }, [filtros, refreshKey])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await fetch(`/api/gastos/${deleteId}`, { method: 'DELETE' })
      toast.success('Gasto eliminado')
      setDeleteId(null)
      onDeleted()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleToggleItemField = async (gastoId: number, itemId: number, field: 'incluye_en_total' | 'incluye_en_vencimiento', value: boolean) => {
    try {
      const res = await fetch(`/api/gastos/${gastoId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) throw new Error()
      setGastos(prev => prev.map(g => {
        if (g.id !== gastoId) return g
        return { ...g, items: g.items.map(i => i.id === itemId ? { ...i, [field]: value } : i) }
      }))
      if (field === 'incluye_en_vencimiento') triggerResumenRefresh()
    } catch {
      toast.error('Error al actualizar')
    }
  }

  const refreshGasto = (gastoId: number, updateDialog?: (g: Gasto) => void) => {
    fetch(`/api/gastos/${gastoId}`)
      .then(r => r.json())
      .then(updated => {
        setGastos(prev => prev.map(g => g.id === updated.id ? updated : g))
        updateDialog?.(updated)
      })
  }

  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const columns: GridColDef[] = [
    {
      field: '_expand',
      headerName: '',
      width: 90,
      sortable: false,
      disableColumnMenu: true,
      renderCell: ({ row }) => {
        if (row._type === 'item' || row._type === 'items_total') return null
        const hasItems = (row.items?.length ?? 0) > 0
        const expanded = expandedIds.has(row.id)
        return (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {row.confirmado === false && (
              <Tooltip title="Gasto no confirmado">
                <WarningAmberIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
              </Tooltip>
            )}
            {hasItems && (
              <Tooltip title={expanded ? 'Ocultar sub-items' : 'Ver sub-items'}>
                <IconButton size="small" onClick={() => toggleExpand(row.id)}>
                  {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            )}
            {row.es_tarjeta && (
              <Tooltip
                arrow
                title={
                  row.cierre ? (
                    <Box>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        <strong>Cierre:</strong> {row.cierre.fecha_cierre || '—'}
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        <strong>Vencimiento:</strong> {row.cierre.fecha_vencimiento || '—'}
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        <strong>Próximo cierre:</strong> {row.cierre.fecha_proximo_cierre || '—'}
                      </Typography>
                    </Box>
                  ) : 'Sin cierre cargado para este mes/año — configurarlo en /configuracion'
                }
              >
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', ml: 0.5 }}>
                  <BrandLogo marca={row.tarjeta_marca} width={30} height={22} />
                </Box>
              </Tooltip>
            )}
          </Box>
        )
      },
    },
    {
      field: 'fecha_vencimiento',
      headerName: 'Vencimiento',
      width: 110,
      renderCell: ({ value, row }) => {
        if (row._type === 'items_total') return null
        if (row._type === 'item') return (
          <Typography variant="caption" color="text.disabled" sx={{ pl: 1 }}>{row._fecha ?? ''}</Typography>
        )
        const isToday = value === today
        const isPast = value < today && row.total_restante > 0
        return (
          <span style={{ color: isToday ? '#ef4444' : isPast ? '#f59e0b' : undefined, fontWeight: isToday || isPast ? 600 : undefined }}>
            {value}
          </span>
        )
      },
    },
    {
      field: 'descripcion',
      headerName: 'Descripción',
      flex: 1,
      minWidth: 150,
      renderCell: ({ value, row }) => {
        if (row._type === 'items_total') {
          const matches = row._matches
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                TOTAL SUB-ITEMS
              </Typography>
              <Typography variant="caption" sx={{ color: matches ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                {matches ? '✓ Coincide' : '✗ No coincide'}
              </Typography>
            </Box>
          )
        }
        if (row._type === 'item') return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 1 }}>
            <SubdirectoryArrowRightIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary" noWrap>{value}</Typography>
          </Box>
        )
        return value
      },
    },
    {
      field: 'tipo_pago',
      headerName: 'Pago',
      width: 90,
      renderCell: ({ value, row }) => {
        if (row._type === 'item' || row._type === 'items_total') return null
        return (
          <Chip
            label={value === 'C' ? 'Crédito' : 'Débito'}
            size="small"
            color={value === 'C' ? 'primary' : 'default'}
            variant="outlined"
          />
        )
      },
    },
    {
      field: 'total_moneda',
      headerName: 'Total Moneda',
      width: 160,
      renderCell: ({ value, row }) => {
        if (row._type === 'item' || row._type === 'items_total') return null
        const base = fmtNum(value, row.moneda_simbolo ?? '$')
        if (row.moneda_codigo === 'ARS') return base
        return `${base} ($${new Intl.NumberFormat('es-AR').format(row.tipo_cambio)})`
      },
    },
    {
      field: 'total_ars',
      headerName: 'Total ARS',
      width: 130,
      renderCell: ({ value, row }) => {
        if (row._type === 'items_total') return (
          <span style={{ color: row._matches ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
            {fmtARS(row._itemsTotal)}
          </span>
        )
        if (row._type === 'item') return (
          <span style={{ color: '#a78bfa', fontWeight: 600 }}>{fmtARS(row._monto)}</span>
        )
        if (!row.confirmado && row.items?.length > 0) {
          const itemsTotal = row.items.filter((i: any) => i.incluye_en_total).reduce((s: number, i: any) => s + i.monto, 0)
          return <span style={{ fontWeight: 600, color: '#f59e0b' }}>{fmtARS(itemsTotal)}</span>
        }
        return <span style={{ fontWeight: 600 }}>{fmtARS(value)}</span>
      },
    },
    {
      field: 'total_pagado',
      headerName: 'Pagado',
      width: 120,
      renderCell: ({ value, row }) => {
        if (row._type === 'item' || row._type === 'items_total') return null
        return <span style={{ color: '#22c55e' }}>{fmtARS(value)}</span>
      },
    },
    {
      field: 'total_restante',
      headerName: 'Restante',
      width: 120,
      renderCell: ({ value, row }) => {
        if (row._type === 'item' || row._type === 'items_total') return null
        return (
          <span style={{ color: value > 0 ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>
            {fmtARS(value)}
          </span>
        )
      },
    },
    {
      field: 'pasaje_mes_siguiente',
      headerName: 'Pasaje',
      width: 110,
      renderCell: ({ value, row }) => {
        if (row._type === 'item' || row._type === 'items_total') return '-'
        return value > 0 ? <span style={{ color: '#ec4899' }}>{fmtARS(value)}</span> : '-'
      },
    },
    {
      field: 'prestamo_a_otro',
      headerName: 'Préstamo',
      width: 110,
      renderCell: ({ value, row }) => {
        if (row._type === 'item' || row._type === 'items_total') return '-'
        return value > 0 ? <span style={{ color: '#8b5cf6' }}>{fmtARS(value)}</span> : '-'
      },
    },
    {
      field: 'cuota_actual',
      headerName: 'Cuotas',
      width: 80,
      renderCell: ({ row }) => {
        if (row._type === 'items_total') return null
        if (row._type === 'item') {
          if (row._cuota_actual == null && row._cuotas_totales == null) return null
          const actual = row._cuota_actual ?? '?'
          const total = row._cuotas_totales ?? '?'
          return <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>{actual}/{total}</Typography>
        }
        if (!row.cuota_actual && !row.cuotas_totales) return '-'
        const actual = row.cuota_actual ?? '?'
        const total = row.cuotas_totales ?? '?'
        return <span style={{ fontWeight: 600 }}>{actual}/{total}</span>
      },
    },
    {
      field: 'categoria_nombre',
      headerName: 'Categoría',
      width: 130,
      renderCell: ({ value, row }) => {
        if (row._type === 'items_total') return null
        if (row._type === 'item') return row._categoria_nombre
          ? <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>{row._categoria_nombre}</Typography>
          : null
        return value || '-'
      },
    },
    {
      field: 'actions',
      headerName: '',
      width: 160,
      sortable: false,
      disableColumnMenu: true,
      renderCell: ({ row }) => {
        if (row._type === 'items_total') return null
        if (row._type === 'item') return (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title={row._incluye_en_total ? 'Incluido en total' : 'Excluido del total'}>
              <Switch
                size="small"
                checked={!!row._incluye_en_total}
                onChange={(e) => handleToggleItemField(row._parentId, row._itemId, 'incluye_en_total', e.target.checked)}
                onClick={(e) => e.stopPropagation()}
              />
            </Tooltip>
            <Tooltip title={row._incluye_en_vencimiento ? 'Incluido en vencimientos' : 'Excluido de vencimientos'}>
              <Switch
                size="small"
                checked={!!row._incluye_en_vencimiento}
                onChange={(e) => handleToggleItemField(row._parentId, row._itemId, 'incluye_en_vencimiento', e.target.checked)}
                onClick={(e) => e.stopPropagation()}
              />
            </Tooltip>
          </Box>
        )
        return (
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <Tooltip title="Sub-items">
              <IconButton size="small" onClick={() => setItemGasto(row as Gasto)}>
                <ViewListIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Pagos">
              <IconButton size="small" onClick={() => setPagoGasto(row as Gasto)}>
                <PaymentsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Copiar a otro mes">
              <IconButton size="small" onClick={() => setCopiarGasto(row as Gasto)}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Editar">
              <IconButton size="small" onClick={() => onEdit(row as Gasto)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Eliminar">
              <IconButton size="small" onClick={() => setDeleteId(row.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )
      },
    },
  ]

  const gridSx = {
    '& .row-subitem': {
      bgcolor: 'rgba(255,255,255,0.03)',
      '&:hover': { bgcolor: 'rgba(99,102,241,0.04)' },
    },
    '& .row-items-total': {
      bgcolor: 'rgba(255,255,255,0.06)',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
    },
    '& .row-unconfirmed': {
      bgcolor: 'rgba(245,158,11,0.12)',
      '&:hover': { bgcolor: 'rgba(245,158,11,0.2)' },
    },
    '& .row-unconfirmed-sub': {
      bgcolor: 'rgba(245,158,11,0.07)',
      '&:hover': { bgcolor: 'rgba(245,158,11,0.14)' },
    },
  }

  const gastosFiltrados = gastos.filter(g => {
    if (estadoPago === 'saldado') return g.total_restante <= 0 && g.confirmado
    if (estadoPago === 'pendiente') return g.total_restante > 0 || !g.confirmado
    return true
  }).filter(g => {
    if (!busqueda.trim()) return true
    const q = busqueda.toLowerCase()
    return g.descripcion.toLowerCase().includes(q) || g.categoria_nombre?.toLowerCase().includes(q)
  })

  // Agrupar por casa
  const groups = gastosFiltrados.reduce<Record<string, { nombre: string; rows: Gasto[] }>>((acc, g) => {
    const key = String(g.casa_id ?? 'sin-casa')
    if (!acc[key]) acc[key] = { nombre: g.casa_nombre ?? 'Sin casa', rows: [] }
    acc[key].rows.push(g)
    return acc
  }, {})

  const groupEntries = Object.values(groups)

  // Construir filas planas con sub-items inyectados cuando están expandidos (para DataGrid)
  const buildFlatRows = (gastoRows: Gasto[]) => {
    const result: any[] = []
    for (const g of gastoRows) {
      result.push({ ...g, _type: 'gasto' })
      if (expandedIds.has(g.id) && g.items?.length) {
        const sortedItems = [...g.items].sort((a, b) => {
          if (!a.fecha && !b.fecha) return 0
          if (!a.fecha) return 1
          if (!b.fecha) return -1
          return a.fecha.localeCompare(b.fecha)
        })
        const itemsTotal = g.items.filter(i => i.incluye_en_total).reduce((s, i) => s + i.monto, 0)
        const matches = Math.abs(itemsTotal - g.total_ars) < 0.005
        result.push({
          id: `total_${g.id}`,
          _type: 'items_total',
          _parentId: g.id,
          _parentConfirmado: g.confirmado,
          _itemsTotal: itemsTotal,
          _gastoTotal: g.total_ars,
          _matches: matches,
        })
        for (const item of sortedItems) {
          result.push({
            id: `item_${item.id}`,
            _type: 'item',
            _itemId: item.id,
            _parentId: g.id,
            _parentConfirmado: g.confirmado,
            descripcion: item.descripcion,
            _monto: item.monto,
            _fecha: item.fecha,
            _cuota_actual: item.cuota_actual,
            _cuotas_totales: item.cuotas_totales,
            _incluye_en_total: item.incluye_en_total,
            _incluye_en_vencimiento: item.incluye_en_vencimiento,
            _categoria_nombre: item.categoria_nombre ?? null,
          })
        }
      }
    }
    return result
  }

  // Render de una card en mobile para un gasto
  const renderGastoCard = (g: Gasto) => {
    const isToday = g.fecha_vencimiento === today
    const isPast = g.fecha_vencimiento < today && g.total_restante > 0
    const vencColor = isToday ? '#ef4444' : isPast ? '#f59e0b' : undefined
    const hasItems = (g.items?.length ?? 0) > 0
    const expanded = expandedIds.has(g.id)
    const displayTotalARS = !g.confirmado && hasItems
      ? g.items.filter(i => i.incluye_en_total).reduce((s, i) => s + i.monto, 0)
      : g.total_ars

    return (
      <Card
        key={g.id}
        variant="outlined"
        sx={{
          bgcolor: g.confirmado === false ? 'rgba(245,158,11,0.12)' : undefined,
          borderColor: g.confirmado === false ? 'rgba(245,158,11,0.3)' : undefined,
        }}
      >
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          {/* Header: descripción + menu */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                {g.confirmado === false && (
                  <WarningAmberIcon sx={{ fontSize: 14, color: '#f59e0b', flexShrink: 0 }} />
                )}
                <Typography variant="body2" fontWeight={600} sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {g.descripcion}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, fontSize: 12 }}>
                <Chip
                  label={g.tipo_pago === 'C' ? 'Crédito' : 'Débito'}
                  size="small"
                  color={g.tipo_pago === 'C' ? 'primary' : 'default'}
                  variant="outlined"
                  sx={{ height: 20, fontSize: 11 }}
                />
                <Typography variant="caption" sx={{ color: vencColor, fontWeight: vencColor ? 600 : undefined }}>
                  {g.fecha_vencimiento}
                </Typography>
                {(g.cuota_actual != null || g.cuotas_totales != null) && (
                  <Typography variant="caption" color="text.secondary">
                    Cuota {g.cuota_actual ?? '?'}/{g.cuotas_totales ?? '?'}
                  </Typography>
                )}
                {g.categoria_nombre && (
                  <Typography variant="caption" color="text.secondary">
                    📍 {g.categoria_nombre}
                  </Typography>
                )}
              </Box>
            </Box>
            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor({ el: e.currentTarget, gasto: g })}
              sx={{ flexShrink: 0 }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Totales */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.5, mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Total</Typography>
              <Typography variant="body2" fontWeight={600} sx={{ color: !g.confirmado && hasItems ? '#f59e0b' : undefined }}>
                {fmtARS(displayTotalARS)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Pagado</Typography>
              <Typography variant="body2" fontWeight={600} sx={{ color: '#22c55e' }}>
                {fmtARS(g.total_pagado)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Restante</Typography>
              <Typography variant="body2" fontWeight={600} sx={{ color: g.total_restante > 0 ? '#f59e0b' : '#22c55e' }}>
                {fmtARS(g.total_restante)}
              </Typography>
            </Box>
          </Box>

          {/* Extras opcionales */}
          {(g.pasaje_mes_siguiente > 0 || g.prestamo_a_otro > 0 || (g.moneda_codigo !== 'ARS')) && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
              {g.moneda_codigo !== 'ARS' && (
                <Typography variant="caption" color="text.secondary">
                  {fmtNum(g.total_moneda, g.moneda_simbolo ?? '$')} (TC ${new Intl.NumberFormat('es-AR').format(g.tipo_cambio)})
                </Typography>
              )}
              {g.pasaje_mes_siguiente > 0 && (
                <Typography variant="caption" sx={{ color: '#ec4899' }}>
                  Pasaje: {fmtARS(g.pasaje_mes_siguiente)}
                </Typography>
              )}
              {g.prestamo_a_otro > 0 && (
                <Typography variant="caption" sx={{ color: '#8b5cf6' }}>
                  Préstamo: {fmtARS(g.prestamo_a_otro)}
                </Typography>
              )}
            </Box>
          )}

          {/* Botón expandir sub-items */}
          {hasItems && (
            <Box sx={{ mt: 1 }}>
              <Box
                onClick={() => toggleExpand(g.id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  cursor: 'pointer', color: 'primary.main',
                  fontSize: 12, fontWeight: 500,
                  userSelect: 'none',
                }}
              >
                {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                {expanded ? 'Ocultar' : 'Ver'} {g.items.length} sub-item{g.items.length !== 1 ? 's' : ''}
              </Box>
              {expanded && renderSubItems(g)}
            </Box>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderSubItems = (g: Gasto) => {
    const sortedItems = [...g.items].sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0
      if (!a.fecha) return 1
      if (!b.fecha) return -1
      return a.fecha.localeCompare(b.fecha)
    })
    const itemsTotal = g.items.filter(i => i.incluye_en_total).reduce((s, i) => s + i.monto, 0)
    const matches = Math.abs(itemsTotal - g.total_ars) < 0.005

    return (
      <Box sx={{ mt: 1, pl: 1, borderLeft: '2px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, mb: 0.5, borderBottom: '1px dashed', borderColor: 'divider' }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary">TOTAL SUB-ITEMS</Typography>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" sx={{ color: matches ? '#22c55e' : '#ef4444', fontWeight: 700, display: 'block', lineHeight: 1.2 }}>
              {fmtARS(itemsTotal)}
            </Typography>
            <Typography variant="caption" sx={{ color: matches ? '#22c55e' : '#ef4444', fontSize: 10 }}>
              {matches ? '✓ Coincide' : '✗ No coincide'}
            </Typography>
          </Box>
        </Box>
        {sortedItems.map(item => (
          <Box key={item.id} sx={{ py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ color: '#a78bfa', flex: 1, fontSize: 13 }}>
                {item.descripcion}
              </Typography>
              <Typography variant="body2" fontWeight={600} sx={{ fontSize: 13 }}>
                {fmtARS(item.monto)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              {item.fecha && <Typography variant="caption" color="text.disabled">{item.fecha}</Typography>}
              {(item.cuota_actual != null || item.cuotas_totales != null) && (
                <Typography variant="caption" color="text.secondary">
                  {item.cuota_actual ?? '?'}/{item.cuotas_totales ?? '?'}
                </Typography>
              )}
              {item.categoria_nombre && <Typography variant="caption" color="text.disabled">📍 {item.categoria_nombre}</Typography>}
              <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Tooltip title="Incluido en total">
                  <Switch
                    size="small"
                    checked={!!item.incluye_en_total}
                    onChange={(e) => handleToggleItemField(g.id, item.id, 'incluye_en_total', e.target.checked)}
                  />
                </Tooltip>
                <Tooltip title="Incluido en vencimientos">
                  <Switch
                    size="small"
                    checked={!!item.incluye_en_vencimiento}
                    onChange={(e) => handleToggleItemField(g.id, item.id, 'incluye_en_vencimiento', e.target.checked)}
                  />
                </Tooltip>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    )
  }

  if (loading) {
    if (isMobile) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <Typography variant="body2" color="text.secondary">Cargando...</Typography>
        </Box>
      )
    }
    return <AppDataGrid rows={[]} columns={columns} loading autoHeight sx={gridSx} />
  }

  if (groupEntries.length === 0) {
    return (
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          {busqueda.trim() ? 'No se encontraron gastos para esa búsqueda.' : 'No hay gastos para el período seleccionado.'}
        </Typography>
      </Box>
    )
  }

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
        {groupEntries.map(({ nombre, rows }) => {
          const totalARS = rows.reduce((s, r) => s + r.total_ars, 0)
          const totalRestante = rows.reduce((s, r) => s + r.total_restante, 0)
          return (
            <Box key={nombre}>
              {/* Header del grupo */}
              <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'stretch', sm: 'center' },
                justifyContent: 'space-between',
                gap: 0.5,
                mb: 1, px: 0.5,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HomeIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                  <Typography fontWeight={700} fontSize={15}>{nombre}</Typography>
                  <Chip label={`${rows.length} gasto${rows.length !== 1 ? 's' : ''}`} size="small" variant="outlined" />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Typography variant="body2" color="text.secondary">
                    Total: <strong style={{ color: '#fff' }}>{fmtARS(totalARS)}</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Restante: <strong style={{ color: totalRestante > 0 ? '#f59e0b' : '#22c55e' }}>{fmtARS(totalRestante)}</strong>
                  </Typography>
                </Box>
              </Box>

              {/* Cards en mobile, DataGrid en desktop */}
              {isMobile ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {rows.map(g => renderGastoCard(g))}
                </Box>
              ) : (
                <AppDataGrid
                  rows={buildFlatRows(sortGastos(rows))}
                  columns={columns}
                  autoHeight
                  hideFooter
                  sortingMode="server"
                  sortModel={sortModel}
                  onSortModelChange={(m) => setSortModel(m)}
                  getRowId={row => row.id}
                  getRowClassName={({ row }) => {
                    if (row._type === 'gasto') return row.confirmado === false ? 'row-unconfirmed' : ''
                    if (row._type === 'item') return row._parentConfirmado === false ? 'row-unconfirmed-sub row-subitem' : 'row-subitem'
                    if (row._type === 'items_total') return row._parentConfirmado === false ? 'row-unconfirmed-sub row-items-total' : 'row-items-total'
                    return ''
                  }}
                  isRowSelectable={({ row }) => row._type === 'gasto'}
                  selectedRowId={selectedGastoId}
                  onSelectedRowChange={(id) => setSelectedGastoId(id as number | null)}
                  onDeleteKeyPress={(id) => setDeleteId(id as number)}
                  sx={gridSx}
                />
              )}
            </Box>
          )
        })}
      </Box>

      {/* Menú de acciones en mobile */}
      <Menu
        anchorEl={menuAnchor?.el ?? null}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => { if (menuAnchor) setItemGasto(menuAnchor.gasto); setMenuAnchor(null) }}>
          <ListItemIcon><ViewListIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Sub-items</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { if (menuAnchor) setPagoGasto(menuAnchor.gasto); setMenuAnchor(null) }}>
          <ListItemIcon><PaymentsIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Pagos</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { if (menuAnchor) setCopiarGasto(menuAnchor.gasto); setMenuAnchor(null) }}>
          <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Copiar a otro mes</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { if (menuAnchor) onEdit(menuAnchor.gasto); setMenuAnchor(null) }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Editar</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => { if (menuAnchor) setDeleteId(menuAnchor.gasto.id); setMenuAnchor(null) }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Eliminar</ListItemText>
        </MenuItem>
      </Menu>

      <ConfirmDialog
        open={deleteId !== null}
        title="Eliminar gasto"
        message="¿Estás seguro que querés eliminar este gasto? Esta acción no se puede deshacer."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      <PagoDialog
        open={pagoGasto !== null}
        gasto={pagoGasto}
        onClose={() => setPagoGasto(null)}
        onChanged={() => { refreshGasto(pagoGasto!.id, updated => setPagoGasto(updated)); triggerResumenRefresh() }}
      />

      <GastoItemDialog
        open={itemGasto !== null}
        gasto={itemGasto}
        onClose={() => setItemGasto(null)}
        onChanged={() => { refreshGasto(itemGasto!.id, updated => setItemGasto(updated)); triggerResumenRefresh() }}
      />

      <CopiarGastoDialog
        open={copiarGasto !== null}
        gasto={copiarGasto}
        onClose={() => setCopiarGasto(null)}
        onCopied={() => { setCopiarGasto(null); onDeleted() }}
      />
    </>
  )
}
