'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { useState } from 'react'
import { useGastosStore } from '@/store/gastosStore'
import ResumenCards from '@/components/gastos/ResumenCards'
import FiltrosGastos from '@/components/gastos/FiltrosGastos'
import GastosTable from '@/components/gastos/GastosTable'
import GastoDialog from '@/components/gastos/GastoDialog'
import CopiarMesDialog from '@/components/gastos/CopiarMesDialog'
import type { Gasto } from '@/lib/types'

export default function GastosPage() {
  const { filtros, setFiltros, dialogOpen, gastoEditando, openDialog, closeDialog, refreshKey, triggerRefresh } = useGastosStore()
  const [copiarMesOpen, setCopiarMesOpen] = useState(false)

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Gastos</Typography>
          <Typography variant="body2" color="text.secondary">
            {MESES[filtros.mes - 1]} {filtros.anio}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<ContentCopyIcon />}
          onClick={() => setCopiarMesOpen(true)}
          size="small"
        >
          Copiar mes
        </Button>
      </Box>

      <ResumenCards filtros={filtros} refreshKey={refreshKey} />
      <FiltrosGastos filtros={filtros} setFiltros={setFiltros} />
      <GastosTable
        filtros={filtros}
        refreshKey={refreshKey}
        onEdit={(gasto: Gasto) => openDialog(gasto)}
        onDeleted={triggerRefresh}
      />

      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => openDialog()}
        sx={{ position: 'fixed', top: 12, right: 24, zIndex: 1200 }}
      >
        Nuevo Gasto
      </Button>

      <CopiarMesDialog
        open={copiarMesOpen}
        filtros={filtros}
        onClose={() => setCopiarMesOpen(false)}
        onCopied={triggerRefresh}
      />

      <GastoDialog
        open={dialogOpen}
        gasto={gastoEditando}
        filtros={filtros}
        onClose={closeDialog}
        onSaved={triggerRefresh}
      />
    </Box>
  )
}
