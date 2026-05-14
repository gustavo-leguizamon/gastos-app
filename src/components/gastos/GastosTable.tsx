'use client'

import { useEffect, useState, useMemo } from 'react'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import HomeIcon from '@mui/icons-material/Home'
import PaymentsIcon from '@mui/icons-material/Payments'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ViewListIcon from '@mui/icons-material/ViewList'
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight'
import Checkbox from '@mui/material/Checkbox'
import toast from 'react-hot-toast'
import { useGastosStore } from '@/store/gastosStore'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import PagoDialog from './PagoDialog'
import GastoItemDialog from './GastoItemDialog'
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
  onEdit: (gasto: Gasto) => void
  onDeleted: () => void
}

export default function GastosTable({ filtros, refreshKey, onEdit, onDeleted }: Props) {
  const triggerResumenRefresh = useGastosStore(s => s.triggerResumenRefresh)
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [loading, setLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [pagoGasto, setPagoGasto] = useState<Gasto | null>(null)
  const [itemGasto, setItemGasto] = useState<Gasto | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

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
      width: 40,
      sortable: false,
      disableColumnMenu: true,
      renderCell: ({ row }) => {
        if (row._type === 'item' || row._type === 'items_total') return null
        const hasItems = (row.items?.length ?? 0) > 0
        if (!hasItems) return null
        const expanded = expandedIds.has(row.id)
        return (
          <Tooltip title={expanded ? 'Ocultar sub-items' : 'Ver sub-items'}>
            <IconButton size="small" onClick={() => toggleExpand(row.id)}>
              {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
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
      width: 130,
      renderCell: ({ value, row }) => {
        if (row._type === 'item' || row._type === 'items_total') return null
        return fmtNum(value, row.moneda_simbolo ?? '$')
      },
    },
    {
      field: 'tipo_cambio',
      headerName: 'T. Cambio',
      width: 100,
      renderCell: ({ value, row }) => {
        if (row._type === 'item' || row._type === 'items_total') return null
        return row.moneda_codigo === 'ARS' ? '-' : `$${new Intl.NumberFormat('es-AR').format(value)}`
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
          <Box>
            <span style={{ color: '#a78bfa', fontWeight: 600 }}>{fmtARS(row._monto)}</span>
            {row._cuota_actual != null && (
              <Typography variant="caption" display="block" color="primary.main">
                {row._cuota_actual}{row._cuotas_totales != null ? `/${row._cuotas_totales}` : ''}
              </Typography>
            )}
          </Box>
        )
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
        if (row._type === 'item' || row._type === 'items_total') return null
        if (!row.cuota_actual && !row.cuotas_totales) return '-'
        const actual = row.cuota_actual ?? '?'
        const total = row.cuotas_totales ?? '?'
        return <span style={{ fontWeight: 600 }}>{actual}/{total}</span>
      },
    },
    {
      field: 'tarjeta_nombre',
      headerName: 'Tarjeta',
      width: 160,
      renderCell: ({ value, row }) => {
        if (row._type === 'item' || row._type === 'items_total') return null
        if (!value) return '-'
        return row.tarjeta_banco ? `${value} (${row.tarjeta_banco})` : value
      },
    },
    {
      field: '_incluye_en_total',
      headerName: 'En total',
      width: 75,
      sortable: false,
      disableColumnMenu: true,
      renderHeader: () => (
        <Tooltip title="Sumar al total de sub-items">
          <Typography variant="caption" fontWeight={700} color="text.secondary" noWrap>En total</Typography>
        </Tooltip>
      ),
      renderCell: ({ row }) => {
        if (row._type !== 'item') return null
        return (
          <Tooltip title={row._incluye_en_total ? 'Incluido en total' : 'Excluido del total'}>
            <Checkbox
              size="small"
              checked={!!row._incluye_en_total}
              onChange={(e) => handleToggleItemField(row._parentId, row._itemId, 'incluye_en_total', e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              sx={{ p: 0.5 }}
            />
          </Tooltip>
        )
      },
    },
    {
      field: '_incluye_en_vencimiento',
      headerName: 'En venc.',
      width: 75,
      sortable: false,
      disableColumnMenu: true,
      renderHeader: () => (
        <Tooltip title="Considerar en vencimientos del día">
          <Typography variant="caption" fontWeight={700} color="text.secondary" noWrap>En venc.</Typography>
        </Tooltip>
      ),
      renderCell: ({ row }) => {
        if (row._type !== 'item') return null
        return (
          <Tooltip title={row._incluye_en_vencimiento ? 'Incluido en vencimientos' : 'Excluido de vencimientos'}>
            <Checkbox
              size="small"
              checked={!!row._incluye_en_vencimiento}
              onChange={(e) => handleToggleItemField(row._parentId, row._itemId, 'incluye_en_vencimiento', e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              sx={{ p: 0.5 }}
            />
          </Tooltip>
        )
      },
    },
    {
      field: 'actions',
      headerName: '',
      width: 130,
      sortable: false,
      disableColumnMenu: true,
      renderCell: ({ row }) => {
        if (row._type === 'item' || row._type === 'items_total') return null
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
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 2,
    '& .MuiDataGrid-columnHeader': {
      bgcolor: 'background.paper',
      fontWeight: 700,
      fontSize: 12,
      color: 'text.secondary',
    },
    '& .MuiDataGrid-row:hover': { bgcolor: 'rgba(99,102,241,0.06)' },
    '& .row-subitem': {
      bgcolor: 'rgba(255,255,255,0.03)',
      '&:hover': { bgcolor: 'rgba(99,102,241,0.04)' },
    },
    '& .row-items-total': {
      bgcolor: 'rgba(255,255,255,0.06)',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
    },
  }

  // Agrupar por casa
  const groups = gastos.reduce<Record<string, { nombre: string; rows: Gasto[] }>>((acc, g) => {
    const key = String(g.casa_id ?? 'sin-casa')
    if (!acc[key]) acc[key] = { nombre: g.casa_nombre ?? 'Sin casa', rows: [] }
    acc[key].rows.push(g)
    return acc
  }, {})

  const groupEntries = Object.values(groups)

  // Construir filas planas con sub-items inyectados cuando están expandidos
  const buildFlatRows = (gastoRows: Gasto[]) => {
    const result: any[] = []
    for (const g of gastoRows) {
      result.push({ ...g, _type: 'gasto' })
      if (expandedIds.has(g.id) && g.items?.length) {
        for (const item of g.items) {
          result.push({
            id: `item_${item.id}`,
            _type: 'item',
            _itemId: item.id,
            _parentId: g.id,
            descripcion: item.descripcion,
            _monto: item.monto,
            _fecha: item.fecha,
            _cuota_actual: item.cuota_actual,
            _cuotas_totales: item.cuotas_totales,
            _incluye_en_total: item.incluye_en_total,
            _incluye_en_vencimiento: item.incluye_en_vencimiento,
          })
        }
        const itemsTotal = g.items.filter(i => i.incluye_en_total).reduce((s, i) => s + i.monto, 0)
        const matches = Math.abs(itemsTotal - g.total_ars) < 0.005
        result.push({
          id: `total_${g.id}`,
          _type: 'items_total',
          _parentId: g.id,
          _itemsTotal: itemsTotal,
          _gastoTotal: g.total_ars,
          _matches: matches,
        })
      }
    }
    return result
  }

  if (loading) {
    return <DataGrid rows={[]} columns={columns} loading autoHeight sx={gridSx} />
  }

  if (groupEntries.length === 0) {
    return (
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">No hay gastos para el período seleccionado.</Typography>
      </Box>
    )
  }

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {groupEntries.map(({ nombre, rows }) => {
          const totalARS = rows.reduce((s, r) => s + r.total_ars, 0)
          const totalRestante = rows.reduce((s, r) => s + r.total_restante, 0)
          const flatRows = buildFlatRows(rows)
          return (
            <Box key={nombre}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, px: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HomeIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                  <Typography fontWeight={700} fontSize={15}>{nombre}</Typography>
                  <Chip label={`${rows.length} gasto${rows.length !== 1 ? 's' : ''}`} size="small" variant="outlined" />
                </Box>
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total: <strong style={{ color: '#fff' }}>{fmtARS(totalARS)}</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Restante: <strong style={{ color: totalRestante > 0 ? '#f59e0b' : '#22c55e' }}>{fmtARS(totalRestante)}</strong>
                  </Typography>
                </Box>
              </Box>
              <DataGrid
                rows={flatRows}
                columns={columns}
                autoHeight
                disableRowSelectionOnClick
                density="compact"
                hideFooter={rows.length <= 25}
                getRowId={row => row.id}
                getRowClassName={({ row }) =>
                  row._type === 'item' ? 'row-subitem' :
                  row._type === 'items_total' ? 'row-items-total' : ''
                }
                isRowSelectable={() => false}
                initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                pageSizeOptions={[25, 50, 100]}
                sx={gridSx}
              />
            </Box>
          )
        })}
      </Box>

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
        onChanged={() => refreshGasto(pagoGasto!.id, updated => setPagoGasto(updated))}
      />

      <GastoItemDialog
        open={itemGasto !== null}
        gasto={itemGasto}
        onClose={() => setItemGasto(null)}
        onChanged={() => refreshGasto(itemGasto!.id, updated => setItemGasto(updated))}
      />
    </>
  )
}
