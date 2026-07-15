'use client'

import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Card from '@mui/material/Card'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import ReportesFiltros, { presetRange, type Preset } from '@/components/reportes/ReportesFiltros'
import ReporteKpis from '@/components/reportes/ReporteKpis'
import ReporteCategoriaChart from '@/components/reportes/ReporteCategoriaChart'
import ReporteMensualChart from '@/components/reportes/ReporteMensualChart'
import ReporteConceptosChart from '@/components/reportes/ReporteConceptosChart'
import ReporteTarjetaChart from '@/components/reportes/ReporteTarjetaChart'
import ReporteTipoPagoChart from '@/components/reportes/ReporteTipoPagoChart'
import type { FiltrosReporte, Reporte, Casa, Categoria, Tarjeta, Concepto } from '@/lib/types'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// Vistas del reporte (submenú). Extensible: agregar acá una nueva entrada suma un tab.
// `incluirTarjetas` decide si se cuentan los "resúmenes de tarjeta" (esTarjeta).
type VistaKey = 'individuales' | 'total'
const VISTAS: { key: VistaKey; label: string; caption: string; incluirTarjetas: boolean }[] = [
  {
    key: 'individuales',
    label: 'Gastos individuales',
    caption: 'Excluye los resúmenes de tarjeta para no doble-contar los consumos. Da el mejor detalle por categoría y concepto.',
    incluirTarjetas: false,
  },
  {
    key: 'total',
    label: 'Total con tarjetas',
    caption: 'Incluye los resúmenes de tarjeta — coincide con el “Total Gastos” de la pantalla de Gastos. El consumo de tarjeta puede aparecer como “Sin categoría”.',
    incluirTarjetas: true,
  },
]

function initialFiltros(): FiltrosReporte {
  return {
    ...presetRange('6'),
    casa_id: null,
    tipo_pago: null,
    categoria_ids: [],
    tarjeta_ids: [],
    concepto_ids: [],
  }
}

function buildParams(f: FiltrosReporte, incluirTarjetas: boolean): string {
  const p = new URLSearchParams({
    mes_desde: String(f.mes_desde),
    anio_desde: String(f.anio_desde),
    mes_hasta: String(f.mes_hasta),
    anio_hasta: String(f.anio_hasta),
  })
  if (f.casa_id != null) p.set('casa_id', String(f.casa_id))
  if (f.tipo_pago) p.set('tipo_pago', f.tipo_pago)
  if (f.categoria_ids.length) p.set('categoria_ids', f.categoria_ids.join(','))
  if (f.tarjeta_ids.length) p.set('tarjeta_ids', f.tarjeta_ids.join(','))
  if (f.concepto_ids.length) p.set('concepto_ids', f.concepto_ids.join(','))
  if (incluirTarjetas) p.set('incluir_tarjetas', 'true')
  return p.toString()
}

export default function ReportesPage() {
  const [filtros, setFiltros] = useState<FiltrosReporte>(initialFiltros)
  const [preset, setPreset] = useState<Preset>('6')
  const [vista, setVista] = useState<VistaKey>('individuales')
  const [casas, setCasas] = useState<Casa[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([])
  const [conceptos, setConceptos] = useState<Concepto[]>([])
  const [reporte, setReporte] = useState<Reporte | null>(null)
  const [loading, setLoading] = useState(true)

  const vistaActual = VISTAS.find((v) => v.key === vista)!

  // Opciones de los filtros (una sola vez).
  useEffect(() => {
    Promise.all([
      fetch('/api/casas').then((r) => r.json()).catch(() => []),
      fetch('/api/categorias').then((r) => r.json()).catch(() => []),
      fetch('/api/tarjetas').then((r) => r.json()).catch(() => []),
      fetch('/api/conceptos').then((r) => r.json()).catch(() => []),
    ]).then(([cs, cats, ts, cons]) => {
      setCasas(Array.isArray(cs) ? cs : [])
      setCategorias(Array.isArray(cats) ? cats : [])
      setTarjetas(Array.isArray(ts) ? ts : [])
      setConceptos(Array.isArray(cons) ? cons : [])
    })
  }, [])

  // Datos del reporte cada vez que cambian los filtros o la vista.
  useEffect(() => {
    setLoading(true)
    const ctrl = new AbortController()
    fetch(`/api/reportes?${buildParams(filtros, vistaActual.incluirTarjetas)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: Reporte) => setReporte(d))
      .catch((e) => { if (e.name !== 'AbortError') setReporte(null) })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [filtros, vistaActual.incluirTarjetas])

  const rangoLabel = useMemo(() => {
    const desde = `${MESES[filtros.mes_desde - 1]} ${filtros.anio_desde}`
    const hasta = `${MESES[filtros.mes_hasta - 1]} ${filtros.anio_hasta}`
    return desde === hasta ? desde : `${desde} → ${hasta}`
  }, [filtros])

  const sinDatos = reporte && reporte.kpis.cantidad_gastos === 0

  return (
    <Box sx={{ pb: { xs: 6, sm: 8 } }}>
      <Box sx={{ mb: { xs: 1.5, sm: 2 } }}>
        <Typography variant="h5" fontWeight={700}>Reportes</Typography>
        <Typography variant="body2" color="text.secondary">{rangoLabel}</Typography>
      </Box>

      <Tabs
        value={vista}
        onChange={(_, v) => setVista(v as VistaKey)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40, mb: 1 }}
      >
        {VISTAS.map((v) => (
          <Tab key={v.key} value={v.key} label={v.label} sx={{ minHeight: 40, textTransform: 'none' }} />
        ))}
      </Tabs>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: { xs: 2, sm: 3 } }}>
        {vistaActual.caption}
      </Typography>

      <ReportesFiltros
        filtros={filtros}
        setFiltros={setFiltros}
        preset={preset}
        setPreset={setPreset}
        casas={casas}
        categorias={categorias}
        tarjetas={tarjetas}
        conceptos={conceptos}
      />

      {loading && !reporte ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : !reporte ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No se pudo cargar el reporte.</Typography>
        </Card>
      ) : (
        <Box sx={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
          <ReporteKpis reporte={reporte} />
          {sinDatos ? (
            <Card variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No hay gastos que coincidan con los filtros del período.</Typography>
            </Card>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 2, sm: 3 } }}>
              <ReporteCategoriaChart data={reporte.por_categoria} />
              <ReporteMensualChart data={reporte.por_mes} />
              <ReporteTarjetaChart data={reporte.por_tarjeta} />
              <ReporteTipoPagoChart data={reporte.por_tipo_pago} />
              <Box sx={{ gridColumn: { xs: 'auto', md: '1 / -1' } }}>
                <ReporteConceptosChart data={reporte.top_conceptos} />
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
