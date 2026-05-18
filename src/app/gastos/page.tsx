'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Fab from '@mui/material/Fab'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { useState } from 'react'
import { useGastosStore } from '@/store/gastosStore'
import ResumenCards from '@/components/gastos/ResumenCards'
import FiltrosGastos from '@/components/gastos/FiltrosGastos'
import GastosTable from '@/components/gastos/GastosTable'
import GastoDialog from '@/components/gastos/GastoDialog'
import CopiarMesDialog from '@/components/gastos/CopiarMesDialog'
import VencimientosHoyAlert from '@/components/gastos/VencimientosHoyAlert'
import type { Gasto } from '@/lib/types'

export default function GastosPage() {
  const { filtros, setFiltros, dialogOpen, gastoEditando, openDialog, closeDialog, refreshKey, triggerRefresh } = useGastosStore()
  const [copiarMesOpen, setCopiarMesOpen] = useState(false)
  const [estadoPago, setEstadoPago] = useState<'todos' | 'pendiente' | 'saldado'>('pendiente')
  const [busqueda, setBusqueda] = useState('')
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  return (
    <Box>
      <VencimientosHoyAlert />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 2, sm: 3 } }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Gastos</Typography>
          <Typography variant="body2" color="text.secondary">
            {MESES[filtros.mes - 1]} {filtros.anio}
          </Typography>
        </Box>
        {isMobile ? (
          <Tooltip title="Copiar mes">
            <IconButton color="primary" onClick={() => setCopiarMesOpen(true)}>
              <ContentCopyIcon />
            </IconButton>
          </Tooltip>
        ) : (
          <Button
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            onClick={() => setCopiarMesOpen(true)}
            size="small"
          >
            Copiar mes
          </Button>
        )}
      </Box>

      <ResumenCards filtros={filtros} refreshKey={refreshKey} />
      <FiltrosGastos filtros={filtros} setFiltros={setFiltros} estadoPago={estadoPago} setEstadoPago={setEstadoPago} busqueda={busqueda} setBusqueda={setBusqueda} />
      <GastosTable
        filtros={filtros}
        refreshKey={refreshKey}
        estadoPago={estadoPago}
        busqueda={busqueda}
        onEdit={(gasto: Gasto) => openDialog(gasto)}
        onDeleted={triggerRefresh}
      />

      <Fab
        color="primary"
        variant={isMobile ? 'circular' : 'extended'}
        onClick={() => openDialog()}
        sx={{ position: 'fixed', bottom: { xs: 16, sm: 24 }, right: { xs: 16, sm: 24 }, zIndex: 1200 }}
      >
        <AddIcon sx={{ mr: isMobile ? 0 : 1 }} />
        {!isMobile && 'Nuevo Gasto'}
      </Fab>

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
