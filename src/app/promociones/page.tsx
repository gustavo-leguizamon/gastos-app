'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import MediosPromo from '@/components/promociones/MediosPromo'
import PromoCard from '@/components/promociones/PromoCard'
import PromocionDialog from '@/components/promociones/PromocionDialog'
import ReintegrosPorVencer from '@/components/promociones/ReintegrosPorVencer'
import VencimientoReintegroDialog from '@/components/promociones/VencimientoReintegroDialog'
import SemanaPromos from '@/components/promociones/SemanaPromos'
import AsociarGastosDialog from '@/components/promociones/AsociarGastosDialog'
import UsoPromoDialog from '@/components/promociones/UsoPromoDialog'
import { useGastosStore } from '@/store/gastosStore'
import { shiftMonth } from '@/lib/fechas'
import { DIAS_SEMANA, diaSemanaDeFecha, ordenarPorDisponible, promosDelDia } from '@/lib/promociones-compute'
import type { Promocion, PromocionConProgreso, PromocionesResponse, ReintegroPorVencer, ReintegroPromo, Tarjeta } from '@/lib/types'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const fmtARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

/** Fecha local `YYYY-MM-DD` (nunca `toISOString`, que es UTC y corre el día de noche en Argentina). */
function hoyLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Kpi({ label, valor, color, sub }: { label: string; valor: string; color?: string; sub?: string }) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 150 }}>
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h5" fontWeight={800} color={color}>{valor}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  )
}

export default function PromocionesPage() {
  // Comparte el período con el resto de la app: cambiar de mes acá lo cambia en Gastos.
  const filtros = useGastosStore(s => s.filtros)
  const setFiltros = useGastosStore(s => s.setFiltros)

  const [data, setData] = useState<PromocionesResponse | null>(null)
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [editando, setEditando] = useState<Promocion | null>(null)
  const [aBorrar, setABorrar] = useState<PromocionConProgreso | null>(null)
  const [usoDe, setUsoDe] = useState<PromocionConProgreso | null>(null)
  const [asociarDe, setAsociarDe] = useState<PromocionConProgreso | null>(null)
  const [porVencer, setPorVencer] = useState<ReintegroPorVencer[]>([])
  const [vencDe, setVencDe] = useState<{
    promocionId: number; lugar: string; mes: number; anio: number; actual: ReintegroPromo | null
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/promociones?mes=${filtros.mes}&anio=${filtros.anio}`, { cache: 'no-store' })
      setData(r.ok ? await r.json() : null)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [filtros.mes, filtros.anio])

  useEffect(() => { load() }, [load])

  // Los reintegros por vencer son de todos los meses: no dependen del período que se mira.
  const loadVencimientos = useCallback(async () => {
    try {
      const r = await fetch('/api/promociones/vencimientos', { cache: 'no-store' })
      setPorVencer(r.ok ? await r.json() : [])
    } catch {
      setPorVencer([])
    }
  }, [])
  useEffect(() => { loadVencimientos() }, [loadVencimientos])
  const recargar = useCallback(async () => { await Promise.all([load(), loadVencimientos()]) }, [load, loadVencimientos])
  useEffect(() => { fetch('/api/tarjetas').then(r => r.json()).then(setTarjetas).catch(() => {}) }, [])

  const hoy = hoyLocal()
  const [hoyAnio, hoyMes] = hoy.split('-').map(Number)
  const esMesActual = filtros.mes === hoyMes && filtros.anio === hoyAnio
  const diaHoy = diaSemanaDeFecha(hoy)

  const promos = useMemo(() => data?.promociones ?? [], [data])
  // Tarjetas a mano para las que no tengan fila de promo todavía: orden de las cards = lo más
  // útil primero (activas con tope por aprovechar, después las completas y las inactivas).
  const ordenadas = useMemo(() => {
    const efectivas = (p: PromocionConProgreso) => p.activa && p.vigente
    return [...ordenarPorDisponible(promos.filter(efectivas)), ...promos.filter(p => !efectivas(p))]
  }, [promos])
  const deHoy = useMemo(
    () => (esMesActual && diaHoy != null ? ordenarPorDisponible(promosDelDia(promos, diaHoy)) : []),
    [promos, esMesActual, diaHoy],
  )

  const abrirNueva = () => { setEditando(null); setDialogAbierto(true) }
  const abrirEditar = (p: Promocion) => { setEditando(p); setDialogAbierto(true) }

  const handleBorrar = async () => {
    if (!aBorrar) return
    const res = await fetch(`/api/promociones/${aBorrar.id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Error al borrar'); return }
    setABorrar(null)
    toast.success('Promoción eliminada')
    await load()
  }

  const handleBorrarUso = async (promoId: number, usoId: number) => {
    const res = await fetch(`/api/promociones/${promoId}/usos/${usoId}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Error al quitar el uso'); return }
    await load()
  }

  const marcarUsado = async (i: ReintegroPorVencer) => {
    const res = await fetch('/api/promociones/' + i.promocion_id + '/reintegro', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes: i.mes, anio: i.anio, vence_el: i.vence_el, utilizado: true }),
    })
    if (!res.ok) { toast.error('Error al marcar como usado'); return }
    toast.success('Reintegro marcado como usado')
    await recargar()
  }

  const irAMes = (delta: number) => {
    const n = shiftMonth(filtros.mes, filtros.anio, delta)
    setFiltros({ mes: n.mes, anio: n.anio })
  }

  const t = data?.totales

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => irAMes(-1)} aria-label="Mes anterior"><ChevronLeftIcon /></IconButton>
          <Typography variant="h5" fontWeight={800} sx={{ minWidth: 190, textAlign: 'center' }}>
            {MESES[filtros.mes - 1]} {filtros.anio}
          </Typography>
          <IconButton onClick={() => irAMes(1)} aria-label="Mes siguiente"><ChevronRightIcon /></IconButton>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={abrirNueva}>Nueva promoción</Button>
      </Box>

      <ReintegrosPorVencer
        items={porVencer}
        hoy={hoy}
        onEditar={i => setVencDe({
          promocionId: i.promocion_id, lugar: i.lugar, mes: i.mes, anio: i.anio,
          actual: { vence_el: i.vence_el, utilizado: i.utilizado },
        })}
        onUsado={marcarUsado}
      />

      {loading && !data && <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>}
      {!loading && !data && <Alert severity="error">No se pudieron cargar las promociones.</Alert>}

      {data && promos.length === 0 && (
        <Alert severity="info" action={<Button color="inherit" size="small" onClick={abrirNueva}>Crear la primera</Button>}>
          Todavía no cargaste promociones. Cargá lugar, % de reintegro, tope mensual, días y tarjetas, y acá vas a ver
          cuánto gastar para aprovechar cada tope.
        </Alert>
      )}

      {data && promos.length > 0 && t && (
        <>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Kpi label="Reintegrado en el mes" valor={fmtARS(t.reintegrado)} color="success.main" />
            <Kpi label="Por reintegrar" valor={fmtARS(t.disponible)} color="primary.main" sub="Lo que todavía podés recuperar" />
            <Kpi label="Tope total" valor={fmtARS(t.tope_total)} sub={`${t.completas} ${t.completas === 1 ? 'promo completa' : 'promos completas'}`} />
          </Box>

          {esMesActual && diaHoy != null && (
            <Card variant="outlined" sx={{ borderColor: 'primary.main' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={800} gutterBottom>
                  Hoy, {DIAS_SEMANA[diaHoy].toLowerCase()}
                </Typography>
                {deHoy.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">Hoy no hay promociones.</Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {deHoy.map(p => {
                      const completa = p.progreso.estado === 'tope_alcanzado'
                      return (
                        <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                          <Typography fontWeight={700} sx={{ minWidth: 120 }}>{p.lugar}</Typography>
                          <Typography fontWeight={800} color="primary.main">{p.porcentaje}%</Typography>
                          <MediosPromo promo={p} size={20} />
                          <Typography variant="body2" color={completa ? 'success.main' : 'text.secondary'}>
                            {completa
                              ? 'Tope alcanzado este mes'
                              : `Podés recuperar ${fmtARS(p.progreso.disponible)} · gastando ${fmtARS(p.progreso.gasto_restante)} más`}
                          </Typography>
                        </Box>
                      )
                    })}
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          <Box>
            <Typography variant="subtitle1" fontWeight={800} gutterBottom>Semana</Typography>
            <SemanaPromos promos={promos} hoy={esMesActual ? diaHoy : null} onSelect={abrirEditar} />
          </Box>

          <Box>
            <Typography variant="subtitle1" fontWeight={800} gutterBottom>Progreso del mes</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: 2 }}>
              {ordenadas.map(p => (
                <PromoCard
                  key={p.id}
                  promo={p}
                  hoy={esMesActual ? diaHoy : null}
                  hoyFecha={hoy}
                  onVencimiento={() => setVencDe({
                    promocionId: p.id, lugar: p.lugar, mes: filtros.mes, anio: filtros.anio, actual: p.reintegro,
                  })}
                  onUso={() => setUsoDe(p)}
                  onAsociar={() => setAsociarDe(p)}
                  onEditar={() => abrirEditar(p)}
                  onBorrar={() => setABorrar(p)}
                  onBorrarUso={usoId => handleBorrarUso(p.id, usoId)}
                />
              ))}
            </Box>
          </Box>
        </>
      )}

      <PromocionDialog
        open={dialogAbierto}
        onClose={() => setDialogAbierto(false)}
        onSaved={load}
        editando={editando}
        tarjetas={tarjetas}
        mes={filtros.mes}
        anio={filtros.anio}
      />
      <UsoPromoDialog
        promo={usoDe}
        fechaInicial={esMesActual ? hoy : `${filtros.anio}-${String(filtros.mes).padStart(2, '0')}-01`}
        onClose={() => setUsoDe(null)}
        onSaved={load}
      />
      <AsociarGastosDialog
        promo={asociarDe}
        mes={filtros.mes}
        anio={filtros.anio}
        onClose={() => setAsociarDe(null)}
        onSaved={load}
      />
      <VencimientoReintegroDialog objetivo={vencDe} onClose={() => setVencDe(null)} onSaved={recargar} />
      <ConfirmDialog
        open={!!aBorrar}
        title="Eliminar promoción"
        message={`¿Eliminar la promoción de ${aBorrar?.lugar ?? ''}? También se borran los usos que registraste a mano.`}
        onConfirm={handleBorrar}
        onCancel={() => setABorrar(null)}
      />
    </Box>
  )
}
