'use client'

import { useEffect, useState } from 'react'
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import HomeIcon from '@mui/icons-material/Home'
import PaymentsIcon from '@mui/icons-material/Payments'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import PagoDialog from './PagoDialog'
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
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [loading, setLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [pagoGasto, setPagoGasto] = useState<Gasto | null>(null)

  useEffect(() => {
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
  }, [filtros, refreshKey])

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

  const today = new Date().toISOString().split('T')[0]

  const columns: GridColDef[] = [
    {
      field: 'fecha_vencimiento',
      headerName: 'Vencimiento',
      width: 110,
      renderCell: ({ value, row }) => {
        const isToday = value === today
        const isPast = value < today && row.total_restante > 0
        return (
          <span style={{ color: isToday ? '#ef4444' : isPast ? '#f59e0b' : undefined, fontWeight: isToday || isPast ? 600 : undefined }}>
            {value}
          </span>
        )
      },
    },
    { field: 'descripcion', headerName: 'Descripción', flex: 1, minWidth: 150 },
    {
      field: 'tipo_pago',
      headerName: 'Pago',
      width: 90,
      renderCell: ({ value }) => (
        <Chip
          label={value === 'C' ? 'Crédito' : 'Débito'}
          size="small"
          color={value === 'C' ? 'primary' : 'default'}
          variant="outlined"
        />
      ),
    },
    {
      field: 'total_moneda',
      headerName: 'Total Moneda',
      width: 130,
      renderCell: ({ value, row }) => fmtNum(value, row.moneda_simbolo ?? '$'),
    },
    {
      field: 'tipo_cambio',
      headerName: 'T. Cambio',
      width: 100,
      renderCell: ({ value, row }) =>
        row.moneda_codigo === 'ARS' ? '-' : `$${new Intl.NumberFormat('es-AR').format(value)}`,
    },
    {
      field: 'total_ars',
      headerName: 'Total ARS',
      width: 130,
      renderCell: ({ value }) => (
        <span style={{ fontWeight: 600 }}>{fmtARS(value)}</span>
      ),
    },
    {
      field: 'total_pagado',
      headerName: 'Pagado',
      width: 120,
      renderCell: ({ value }) => <span style={{ color: '#22c55e' }}>{fmtARS(value)}</span>,
    },
    {
      field: 'total_restante',
      headerName: 'Restante',
      width: 120,
      renderCell: ({ value }) => (
        <span style={{ color: value > 0 ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>
          {fmtARS(value)}
        </span>
      ),
    },
    {
      field: 'pasaje_mes_siguiente',
      headerName: 'Pasaje',
      width: 110,
      renderCell: ({ value }) => value > 0 ? <span style={{ color: '#ec4899' }}>{fmtARS(value)}</span> : '-',
    },
    {
      field: 'prestamo_a_otro',
      headerName: 'Préstamo',
      width: 110,
      renderCell: ({ value }) => value > 0 ? <span style={{ color: '#8b5cf6' }}>{fmtARS(value)}</span> : '-',
    },
    {
      field: 'tarjeta_nombre',
      headerName: 'Tarjeta',
      width: 130,
      renderCell: ({ value }) => value ?? '-',
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: '',
      width: 110,
      getActions: ({ row }) => [
        <GridActionsCellItem
          key="pagar"
          icon={<PaymentsIcon fontSize="small" />}
          label="Pagos"
          onClick={() => setPagoGasto(row as Gasto)}
        />,
        <GridActionsCellItem
          key="edit"
          icon={<EditIcon fontSize="small" />}
          label="Editar"
          onClick={() => onEdit(row as Gasto)}
        />,
        <GridActionsCellItem
          key="delete"
          icon={<DeleteIcon fontSize="small" />}
          label="Eliminar"
          onClick={() => setDeleteId(row.id)}
          showInMenu={false}
        />,
      ],
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
  }

  // Agrupar por casa
  const groups = gastos.reduce<Record<string, { nombre: string; rows: Gasto[] }>>((acc, g) => {
    const key = String(g.casa_id ?? 'sin-casa')
    if (!acc[key]) acc[key] = { nombre: g.casa_nombre ?? 'Sin casa', rows: [] }
    acc[key].rows.push(g)
    return acc
  }, {})

  const groupEntries = Object.values(groups)

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
                rows={rows}
                columns={columns}
                autoHeight
                disableRowSelectionOnClick
                density="compact"
                hideFooter={rows.length <= 25}
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
        onChanged={() => {
          onDeleted()
          if (pagoGasto) {
            fetch(`/api/gastos/${pagoGasto.id}`)
              .then(r => r.json())
              .then(updated => {
                setGastos(prev => prev.map(g => g.id === updated.id ? updated : g))
                setPagoGasto(updated)
              })
          }
        }}
      />
    </>
  )
}
