'use client'

import { useState, useEffect } from 'react'
import { DataGrid, DataGridProps, GridRowId } from '@mui/x-data-grid'

const BASE_SX = {
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

interface AppDataGridProps extends Omit<DataGridProps, 'density' | 'rowSelectionModel' | 'onRowSelectionModelChange'> {
  // Keyboard Delete support: called when Delete key is pressed on the selected row
  onDeleteKeyPress?: (id: GridRowId) => void
  // Controlled selection for multi-grid pages where selection must be shared
  selectedRowId?: GridRowId | null
  onSelectedRowChange?: (id: GridRowId | null) => void
}

export default function AppDataGrid({
  onDeleteKeyPress,
  selectedRowId,
  onSelectedRowChange,
  isRowSelectable,
  sx,
  rows,
  ...props
}: AppDataGridProps) {
  const controlled = selectedRowId !== undefined
  const [internalSelectedId, setInternalSelectedId] = useState<GridRowId | null>(null)
  const effectiveSelectedId = controlled ? selectedRowId : internalSelectedId

  const handleSelectionChange = (model: GridRowId[]) => {
    const id = model[0] ?? null
    if (controlled) onSelectedRowChange?.(id)
    else setInternalSelectedId(id)
  }

  useEffect(() => {
    if (!onDeleteKeyPress) return
    const getRowId = props.getRowId ?? ((r: any) => r.id)
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Delete') return
      if (effectiveSelectedId === null || effectiveSelectedId === undefined) return
      const owned = Array.isArray(rows) && (rows as any[]).some(r => getRowId(r) === effectiveSelectedId)
      if (owned) onDeleteKeyPress(effectiveSelectedId)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [effectiveSelectedId, onDeleteKeyPress, rows, props.getRowId])

  const mergedSx = { ...BASE_SX, ...(sx ?? {}) }

  return (
    <DataGrid
      rows={rows}
      density="compact"
      isRowSelectable={onDeleteKeyPress ? (isRowSelectable ?? (() => true)) : (() => false)}
      rowSelectionModel={effectiveSelectedId != null ? [effectiveSelectedId] : []}
      onRowSelectionModelChange={(model) => handleSelectionChange(model as GridRowId[])}
      sx={mergedSx}
      {...props}
    />
  )
}
