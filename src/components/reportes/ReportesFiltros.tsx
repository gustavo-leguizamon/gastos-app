'use client'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import AppSelect from '@/components/shared/AppSelect'
import AppMultiSelect from '@/components/shared/AppMultiSelect'
import BrandLogo from '@/components/shared/BrandLogo'
import { shiftMonth } from '@/lib/fechas'
import type { FiltrosReporte, Casa, Categoria, Tarjeta, Concepto } from '@/lib/types'

export type Preset = 'mes' | '3' | '6' | '12' | 'anio' | 'custom'

interface Props {
  filtros: FiltrosReporte
  setFiltros: (f: FiltrosReporte) => void
  preset: Preset
  setPreset: (p: Preset) => void
  casas: Casa[]
  categorias: Categoria[]
  tarjetas: Tarjeta[]
  conceptos: Concepto[]
  /** Modo mes único: oculta presets/rango y muestra un solo selector de mes/año. */
  mesUnico?: boolean
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// Rango (desde/hasta) para cada preset, relativo al mes actual local.
export function presetRange(p: Exclude<Preset, 'custom'>): Pick<FiltrosReporte, 'mes_desde' | 'anio_desde' | 'mes_hasta' | 'anio_hasta'> {
  const now = new Date()
  const cm = now.getMonth() + 1
  const cy = now.getFullYear()
  const hasta = { mes_hasta: cm, anio_hasta: cy }
  if (p === 'mes') return { mes_desde: cm, anio_desde: cy, ...hasta }
  if (p === 'anio') return { mes_desde: 1, anio_desde: cy, ...hasta }
  const back = p === '3' ? 2 : p === '6' ? 5 : 11
  const d = shiftMonth(cm, cy, -back)
  return { mes_desde: d.mes, anio_desde: d.anio, ...hasta }
}

export default function ReportesFiltros({ filtros, setFiltros, preset, setPreset, casas, categorias, tarjetas, conceptos, mesUnico }: Props) {
  const now = new Date()
  const years = Array.from({ length: 8 }, (_, i) => now.getFullYear() + 1 - i)
  const mesOpts = MESES.map((m, i) => ({ value: i + 1, label: m }))
  const yearOpts = years.map((y) => ({ value: y, label: String(y) }))

  const handlePreset = (_: unknown, val: Preset | null) => {
    if (!val) return
    setPreset(val)
    if (val !== 'custom') setFiltros({ ...filtros, ...presetRange(val) })
  }

  const setCustom = (patch: Partial<FiltrosReporte>) => {
    setPreset('custom')
    setFiltros({ ...filtros, ...patch })
  }

  // En mes único, mover mes/año setea desde y hasta al mismo valor.
  const setMesUnico = (patch: { mes?: number; anio?: number }) => {
    const mes = patch.mes ?? filtros.mes_hasta
    const anio = patch.anio ?? filtros.anio_hasta
    setFiltros({ ...filtros, mes_desde: mes, mes_hasta: mes, anio_desde: anio, anio_hasta: anio })
  }

  return (
    <Card variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mb: { xs: 2, sm: 3 } }}>
      {mesUnico ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Mes</Typography>
          <AppSelect label="Mes" options={mesOpts} value={filtros.mes_hasta} onChange={(v) => setMesUnico({ mes: Number(v) })} disableClearable sx={{ width: 150 }} />
          <AppSelect label="Año" options={yearOpts} value={filtros.anio_hasta} onChange={(v) => setMesUnico({ anio: Number(v) })} disableClearable sx={{ width: 110 }} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ width: { xs: '100%', sm: 'auto' } }}>
              Período
            </Typography>
            <ToggleButtonGroup value={preset} exclusive onChange={handlePreset} size="small" sx={{ flexWrap: 'wrap' }}>
              <ToggleButton value="mes">Este mes</ToggleButton>
              <ToggleButton value="3">Últimos 3</ToggleButton>
              <ToggleButton value="6">Últimos 6</ToggleButton>
              <ToggleButton value="12">Últimos 12</ToggleButton>
              <ToggleButton value="anio">Este año</ToggleButton>
              <ToggleButton value="custom">Personalizado</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {preset === 'custom' && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">Desde</Typography>
                <AppSelect label="Mes" options={mesOpts} value={filtros.mes_desde} onChange={(v) => setCustom({ mes_desde: Number(v) })} disableClearable sx={{ width: 140 }} />
                <AppSelect label="Año" options={yearOpts} value={filtros.anio_desde} onChange={(v) => setCustom({ anio_desde: Number(v) })} disableClearable sx={{ width: 100 }} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">Hasta</Typography>
                <AppSelect label="Mes" options={mesOpts} value={filtros.mes_hasta} onChange={(v) => setCustom({ mes_hasta: Number(v) })} disableClearable sx={{ width: 140 }} />
                <AppSelect label="Año" options={yearOpts} value={filtros.anio_hasta} onChange={(v) => setCustom({ anio_hasta: Number(v) })} disableClearable sx={{ width: 100 }} />
              </Box>
            </Box>
          )}
        </>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
        <AppMultiSelect
          label="Categorías"
          options={categorias.map((c) => ({ value: c.id, label: c.nombre }))}
          value={filtros.categoria_ids}
          onChange={(v) => setFiltros({ ...filtros, categoria_ids: v.map(Number) })}
          placeholder="Todas"
          fullWidth
        />
        <AppMultiSelect
          label="Tarjetas"
          options={tarjetas.map((t) => ({
            value: t.id,
            label: `${t.nombre}${t.banco ? ` (${t.banco})` : ''}`,
            render: () => (
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                <BrandLogo marca={t.marca} width={30} height={22} />
                <span>{t.nombre}{t.banco ? ` (${t.banco})` : ''}</span>
              </Box>
            ),
          }))}
          value={filtros.tarjeta_ids}
          onChange={(v) => setFiltros({ ...filtros, tarjeta_ids: v.map(Number) })}
          placeholder="Todas"
          fullWidth
        />
        <AppMultiSelect
          label="Conceptos"
          options={conceptos.map((c) => ({ value: c.id, label: c.nombre }))}
          value={filtros.concepto_ids}
          onChange={(v) => setFiltros({ ...filtros, concepto_ids: v.map(Number) })}
          placeholder="Todos"
          fullWidth
        />
        <AppSelect
          label="Casa"
          options={casas.map((c) => ({ value: c.id, label: c.nombre }))}
          value={filtros.casa_id}
          onChange={(v) => setFiltros({ ...filtros, casa_id: v == null ? null : Number(v) })}
          emptyLabel="Todas"
          fullWidth
        />
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <ToggleButtonGroup
            value={filtros.tipo_pago}
            exclusive
            size="small"
            onChange={(_, v) => setFiltros({ ...filtros, tipo_pago: v as 'C' | 'D' | null })}
            fullWidth
          >
            <ToggleButton value={null as any}>Todos</ToggleButton>
            <ToggleButton value="C">Crédito</ToggleButton>
            <ToggleButton value="D">Débito</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
    </Card>
  )
}
