'use client'

import { useEffect, useState } from 'react'
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid'
import Chip from '@mui/material/Chip'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
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
    { field: 'casa_nombre', headerName: 'Casa', width: 130 },
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
      width: 80,
      getActions: ({ row }) => [
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

  return (
    <>
      <DataGrid
        rows={gastos}
        columns={columns}
        loading={loading}
        autoHeight
        disableRowSelectionOnClick
        density="compact"
        initialState={{
          pagination: { paginationModel: { pageSize: 25 } },
        }}
        pageSizeOptions={[25, 50, 100]}
        sx={{
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
        }}
      />
      <ConfirmDialog
        open={deleteId !== null}
        title="Eliminar gasto"
        message="¿Estás seguro que querés eliminar este gasto? Esta acción no se puede deshacer."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  )
}
