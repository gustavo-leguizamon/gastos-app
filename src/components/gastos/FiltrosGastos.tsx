'use client'

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Badge from '@mui/material/Badge'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import AppSelect from '@/components/shared/AppSelect'
import AppMultiSelect from '@/components/shared/AppMultiSelect'
import Typography from '@mui/material/Typography'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ToggleButton from '@mui/material/ToggleButton'
import TextField from '@/components/shared/AppTextField'
import AppDateField from '@/components/shared/AppDateField'
import InputAdornment from '@mui/material/InputAdornment'
import Popover from '@mui/material/Popover'
import ButtonBase from '@mui/material/ButtonBase'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import TuneIcon from '@mui/icons-material/Tune'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import BrandLogo from '@/components/shared/BrandLogo'
import type { Casa, Categoria, Etiqueta, Tarjeta, FiltrosGastos } from '@/lib/types'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// Valor centinela para filtrar gastos sin categoría / sin etiquetas / sin tarjeta (los ids reales son > 0).
export const SIN_CLASIFICAR = 0

interface Props {
  filtros: FiltrosGastos
  setFiltros: (f: Partial<FiltrosGastos>) => void
  estadoPago: 'todos' | 'pendiente' | 'saldado'
  setEstadoPago: (v: 'todos' | 'pendiente' | 'saldado') => void
  busqueda: string
  setBusqueda: (v: string) => void
  fecha: string
  setFecha: (v: string) => void
  categoriaIds: number[]
  setCategoriaIds: (v: number[]) => void
  etiquetaIds: number[]
  setEtiquetaIds: (v: number[]) => void
  tarjetaIds: number[]
  setTarjetaIds: (v: number[]) => void
}

export default function FiltrosGastos({ filtros, setFiltros, estadoPago, setEstadoPago, busqueda, setBusqueda, fecha, setFecha, categoriaIds, setCategoriaIds, etiquetaIds, setEtiquetaIds, tarjetaIds, setTarjetaIds }: Props) {
  const [casas, setCasas] = useState<Casa[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([])
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  // Panel de filtros avanzados desplegable
  const [open, setOpen] = useState(false)
  // Año mostrado dentro del popover (puede diferir del filtro mientras se navega)
  const [anioPicker, setAnioPicker] = useState(filtros.anio)

  useEffect(() => {
    fetch('/api/casas').then((r) => r.json()).then(setCasas)
    fetch('/api/categorias').then((r) => r.json()).then(setCategorias)
    fetch('/api/etiquetas').then((r) => r.json()).then(setEtiquetas)
    fetch('/api/tarjetas').then((r) => r.json()).then((d) => setTarjetas(Array.isArray(d) ? d : []))
  }, [])

  const prevMes = () => {
    if (filtros.mes === 1) setFiltros({ mes: 12, anio: filtros.anio - 1 })
    else setFiltros({ mes: filtros.mes - 1 })
    setFecha('')
  }

  const nextMes = () => {
    if (filtros.mes === 12) setFiltros({ mes: 1, anio: filtros.anio + 1 })
    else setFiltros({ mes: filtros.mes + 1 })
    setFecha('')
  }

  const abrirPicker = (e: React.MouseEvent<HTMLElement>) => {
    setAnioPicker(filtros.anio)
    setAnchorEl(e.currentTarget)
  }

  const seleccionarMes = (mes: number) => {
    setFiltros({ mes, anio: anioPicker })
    setFecha('')
    setAnchorEl(null)
  }

  // Acotar el picker de fecha al mes/año seleccionado
  const mm = String(filtros.mes).padStart(2, '0')
  const ultimoDia = new Date(filtros.anio, filtros.mes, 0).getDate()
  const fechaMin = `${filtros.anio}-${mm}-01`
  const fechaMax = `${filtros.anio}-${mm}-${String(ultimoDia).padStart(2, '0')}`

  // Filtros avanzados activos (para el badge del botón y el botón "Limpiar")
  const activos =
    (filtros.casa_id != null ? 1 : 0) +
    (filtros.tipo_pago != null ? 1 : 0) +
    (fecha ? 1 : 0) +
    (categoriaIds.length > 0 ? 1 : 0) +
    (etiquetaIds.length > 0 ? 1 : 0) +
    (tarjetaIds.length > 0 ? 1 : 0)

  const limpiar = () => {
    setFiltros({ casa_id: null, tipo_pago: null })
    setFecha('')
    setCategoriaIds([])
    setEtiquetaIds([])
    setTarjetaIds([])
  }

  return (
    <Card variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mb: 2 }}>
      {/* Barra principal: mes + búsqueda + estado + botón de filtros avanzados */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: { xs: 1, md: 1.5 },
        }}
      >
        {/* Selector de mes */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: { xs: '100%', md: 'auto' }, justifyContent: 'center' }}>
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

        {/* Búsqueda — crece para ocupar el espacio disponible */}
        <TextField
          size="small"
          placeholder="Buscar..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 180 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 16 }} />
              </InputAdornment>
            ),
          }}
        />

        {/* Estado de pago — filtro primario, siempre visible */}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={estadoPago}
          onChange={(_, v) => { if (v) setEstadoPago(v) }}
          sx={{ flexGrow: { xs: 1, md: 0 } }}
        >
          <ToggleButton value="todos" sx={{ flex: { xs: 1, md: 'initial' }, px: 1 }}>Todos</ToggleButton>
          <ToggleButton value="pendiente" sx={{ flex: { xs: 1, md: 'initial' }, px: 1 }}>Pend.</ToggleButton>
          <ToggleButton value="saldado" sx={{ flex: { xs: 1, md: 'initial' }, px: 1 }}>Sald.</ToggleButton>
        </ToggleButtonGroup>

        {/* Botón que despliega los filtros avanzados, con badge de activos */}
        <Badge badgeContent={activos} color="primary" sx={{ flexShrink: 0 }}>
          <Button
            variant={open || activos > 0 ? 'contained' : 'outlined'}
            color={activos > 0 ? 'primary' : 'inherit'}
            size="small"
            onClick={() => setOpen(o => !o)}
            startIcon={<TuneIcon fontSize="small" />}
            endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          >
            Filtros
          </Button>
        </Badge>
      </Box>

      {/* Panel de filtros avanzados */}
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 1.5,
            mt: 2,
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          {/* Casa */}
          <AppSelect
            label="Casa"
            options={casas.map(c => ({ value: c.id, label: c.nombre }))}
            value={filtros.casa_id}
            onChange={(v) => setFiltros({ casa_id: v == null ? null : Number(v) })}
            emptyLabel="Todas"
            fullWidth
          />

          {/* Categorías — incluye "Sin categoría" para filtrar los que no tienen */}
          <AppMultiSelect
            label="Categorías"
            options={[
              { value: SIN_CLASIFICAR, label: 'Sin categoría' },
              ...categorias.map((c) => ({ value: c.id, label: c.nombre })),
            ]}
            value={categoriaIds}
            onChange={(v) => setCategoriaIds(v.map(Number))}
            placeholder="Todas"
            fullWidth
          />

          {/* Etiquetas — incluye "Sin etiquetas" para filtrar los que no tienen */}
          <AppMultiSelect
            label="Etiquetas"
            options={[
              { value: SIN_CLASIFICAR, label: 'Sin etiquetas' },
              ...etiquetas.map((e) => ({ value: e.id, label: e.nombre })),
            ]}
            value={etiquetaIds}
            onChange={(v) => setEtiquetaIds(v.map(Number))}
            placeholder="Todas"
            fullWidth
          />

          {/* Tarjeta de pago — incluye "Sin tarjeta" para los gastos que no se pagan con una */}
          <AppMultiSelect
            label="Tarjetas"
            options={[
              { value: SIN_CLASIFICAR, label: 'Sin tarjeta' },
              ...tarjetas.map((t) => ({
                value: t.id,
                label: `${t.nombre}${t.banco ? ` (${t.banco})` : ''}`,
                render: () => (
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                    <BrandLogo marca={t.marca} width={30} height={22} />
                    <span>{t.nombre}{t.banco ? ` (${t.banco})` : ''}</span>
                  </Box>
                ),
              })),
            ]}
            value={tarjetaIds}
            onChange={(v) => setTarjetaIds(v.map(Number))}
            placeholder="Todas"
            fullWidth
          />

          {/* Filtro por fecha de vencimiento */}
          <AppDateField
            size="small"
            label="Fecha"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            inputProps={{ min: fechaMin, max: fechaMax }}
            fullWidth
            InputProps={{
              endAdornment: fecha ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setFecha('')} edge="end">
                    <ClearIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            }}
          />

          {/* Tipo de pago */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={filtros.tipo_pago}
              onChange={(_, v) => setFiltros({ tipo_pago: v })}
              fullWidth
            >
              <ToggleButton value="C" sx={{ flex: 1, px: 1 }}>Crédito</ToggleButton>
              <ToggleButton value="D" sx={{ flex: 1, px: 1 }}>Débito</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>

        {/* Acción de limpiar los filtros avanzados */}
        {activos > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
            <Button size="small" color="inherit" startIcon={<ClearIcon fontSize="small" />} onClick={limpiar}>
              Limpiar filtros
            </Button>
          </Box>
        )}
      </Collapse>
    </Card>
  )
}
