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
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import type { Casa, FiltrosGastos } from '@/lib/types'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface Props {
  filtros: FiltrosGastos
  setFiltros: (f: Partial<FiltrosGastos>) => void
}

export default function FiltrosGastos({ filtros, setFiltros }: Props) {
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
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
      {/* Selector de mes */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <IconButton size="small" onClick={prevMes}><ChevronLeftIcon /></IconButton>
        <Typography variant="body1" fontWeight={600} sx={{ minWidth: 160, textAlign: 'center' }}>
          {MESES[filtros.mes - 1]} {filtros.anio}
        </Typography>
        <IconButton size="small" onClick={nextMes}><ChevronRightIcon /></IconButton>
      </Box>

      {/* Casa */}
      <FormControl size="small" sx={{ minWidth: 160 }}>
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

      {/* Tipo pago */}
      <ToggleButtonGroup
        size="small"
        exclusive
        value={filtros.tipo_pago}
        onChange={(_, v) => setFiltros({ tipo_pago: v })}
      >
        <ToggleButton value="C">Crédito</ToggleButton>
        <ToggleButton value="D">Débito</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  )
}
