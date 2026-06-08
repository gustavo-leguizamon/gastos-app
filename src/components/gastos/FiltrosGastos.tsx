'use client'

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import AppSelect from '@/components/shared/AppSelect'
import Typography from '@mui/material/Typography'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ToggleButton from '@mui/material/ToggleButton'
import TextField from '@/components/shared/AppTextField'
import InputAdornment from '@mui/material/InputAdornment'
import Popover from '@mui/material/Popover'
import ButtonBase from '@mui/material/ButtonBase'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SearchIcon from '@mui/icons-material/Search'
import type { Casa, FiltrosGastos } from '@/lib/types'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

interface Props {
  filtros: FiltrosGastos
  setFiltros: (f: Partial<FiltrosGastos>) => void
  estadoPago: 'todos' | 'pendiente' | 'saldado'
  setEstadoPago: (v: 'todos' | 'pendiente' | 'saldado') => void
  busqueda: string
  setBusqueda: (v: string) => void
}

export default function FiltrosGastos({ filtros, setFiltros, estadoPago, setEstadoPago, busqueda, setBusqueda }: Props) {
  const [casas, setCasas] = useState<Casa[]>([])
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  // Año mostrado dentro del popover (puede diferir del filtro mientras se navega)
  const [anioPicker, setAnioPicker] = useState(filtros.anio)

  useEffect(() => {
    fetch('/api/casas').then((r) => r.json()).then(setCasas)
  }, [])

  const prevMes = () => {
    if (filtros.mes === 1) setFiltros({ mes: 12, anio: filtros.anio - 1 })
    else setFiltros({ mes: filtros.mes - 1 })
  }

  const nextMes = () => {
    if (filtros.mes === 12) setFiltros({ mes: 1, anio: filtros.anio + 1 })
    else setFiltros({ mes: filtros.mes + 1 })
  }

  const abrirPicker = (e: React.MouseEvent<HTMLElement>) => {
    setAnioPicker(filtros.anio)
    setAnchorEl(e.currentTarget)
  }

  const seleccionarMes = (mes: number) => {
    setFiltros({ mes, anio: anioPicker })
    setAnchorEl(null)
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'stretch', md: 'center' },
        gap: { xs: 1, md: 2 },
        flexWrap: { xs: 'nowrap', md: 'wrap' },
        mb: 2,
      }}
    >
      {/* Selector de mes */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: { xs: 'center', md: 'flex-start' } }}>
        <IconButton size="small" onClick={prevMes}><ChevronLeftIcon /></IconButton>
        <ButtonBase
          onClick={abrirPicker}
          sx={{
            minWidth: 160,
            borderRadius: 1,
            px: 1,
            py: 0.25,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <Typography variant="body1" fontWeight={600} sx={{ width: '100%', textAlign: 'center' }}>
            {MESES[filtros.mes - 1]} {filtros.anio}
          </Typography>
        </ButtonBase>
        <IconButton size="small" onClick={nextMes}><ChevronRightIcon /></IconButton>
      </Box>

      {/* Popover de selección directa mes/año */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Box sx={{ p: 1.5, width: 260 }}>
          {/* Navegación de año */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <IconButton size="small" onClick={() => setAnioPicker((y) => y - 1)}><ChevronLeftIcon /></IconButton>
            <Typography variant="body1" fontWeight={600}>{anioPicker}</Typography>
            <IconButton size="small" onClick={() => setAnioPicker((y) => y + 1)}><ChevronRightIcon /></IconButton>
          </Box>

          {/* Grilla de meses */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
            {MESES_CORTOS.map((m, i) => {
              const activo = filtros.mes === i + 1 && filtros.anio === anioPicker
              return (
                <ButtonBase
                  key={m}
                  onClick={() => seleccionarMes(i + 1)}
                  sx={{
                    borderRadius: 1,
                    py: 1,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: activo ? 'primary.contrastText' : 'text.primary',
                    bgcolor: activo ? 'primary.main' : 'transparent',
                    '&:hover': { bgcolor: activo ? 'primary.dark' : 'action.hover' },
                  }}
                >
                  {m}
                </ButtonBase>
              )
            })}
          </Box>
        </Box>
      </Popover>

      {/* Búsqueda — full width en mobile, antes que los selects */}
      <TextField
        size="small"
        placeholder="Buscar..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        sx={{ width: { xs: '100%', md: 180 }, order: { xs: 1, md: 5 } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 16 }} />
            </InputAdornment>
          ),
        }}
      />

      {/* Casa */}
      <AppSelect
        label="Casa"
        options={casas.map(c => ({ value: c.id, label: c.nombre }))}
        value={filtros.casa_id}
        onChange={(v) => setFiltros({ casa_id: v == null ? null : Number(v) })}
        emptyLabel="Todas"
        sx={{ minWidth: { xs: '100%', md: 160 }, order: { xs: 2, md: 2 } }}
      />

      {/* Toggles agrupados: en mobile se muestran lado a lado en una fila */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          order: { xs: 3, md: 3 },
          flexWrap: 'wrap',
          justifyContent: { xs: 'space-between', md: 'flex-start' },
        }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={filtros.tipo_pago}
          onChange={(_, v) => setFiltros({ tipo_pago: v })}
          sx={{ flex: { xs: 1, md: 'initial' } }}
        >
          <ToggleButton value="C" sx={{ flex: 1, px: 1 }}>Créd.</ToggleButton>
          <ToggleButton value="D" sx={{ flex: 1, px: 1 }}>Déb.</ToggleButton>
        </ToggleButtonGroup>

        <ToggleButtonGroup
          size="small"
          exclusive
          value={estadoPago}
          onChange={(_, v) => { if (v) setEstadoPago(v) }}
          sx={{ flex: { xs: 1, md: 'initial' } }}
        >
          <ToggleButton value="todos" sx={{ flex: 1, px: 1 }}>Todos</ToggleButton>
          <ToggleButton value="pendiente" sx={{ flex: 1, px: 1 }}>Pend.</ToggleButton>
          <ToggleButton value="saldado" sx={{ flex: 1, px: 1 }}>Sald.</ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Box>
  )
}
