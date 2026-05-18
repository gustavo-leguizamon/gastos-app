'use client'

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ToggleButton from '@mui/material/ToggleButton'
import TextField from '@/components/shared/AppTextField'
import InputAdornment from '@mui/material/InputAdornment'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SearchIcon from '@mui/icons-material/Search'
import type { Casa, FiltrosGastos } from '@/lib/types'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

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
        <Typography variant="body1" fontWeight={600} sx={{ minWidth: 160, textAlign: 'center' }}>
          {MESES[filtros.mes - 1]} {filtros.anio}
        </Typography>
        <IconButton size="small" onClick={nextMes}><ChevronRightIcon /></IconButton>
      </Box>

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
      <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 160 }, order: { xs: 2, md: 2 } }}>
        <InputLabel>Casa</InputLabel>
        <Select
          label="Casa"
          value={filtros.casa_id ?? ''}
          onChange={(e) => setFiltros({ casa_id: e.target.value === '' ? null : Number(e.target.value) })}
        >
          <MenuItem value="">Todas</MenuItem>
          {casas.map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
          ))}
        </Select>
      </FormControl>

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
