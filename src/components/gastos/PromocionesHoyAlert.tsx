'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import MediosPromo from '@/components/promociones/MediosPromo'
import VencimientoChip from '@/components/promociones/VencimientoChip'
import { DIAS_SEMANA, avisoPromociones, diaSemanaDeFecha } from '@/lib/promociones-compute'
import type { PromocionConProgreso, PromocionesResponse, ReintegroPorVencer } from '@/lib/types'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const fmtARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

/** Clave de `localStorage` con la última fecha en que se cerró el aviso: sale una vez por día. */
const STORAGE_KEY = 'gastos:aviso-promociones'

function hoyLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function yaVistoHoy(hoy: string) {
  try { return localStorage.getItem(STORAGE_KEY) === hoy } catch { return false }
}

function marcarVisto(hoy: string) {
  try { localStorage.setItem(STORAGE_KEY, hoy) } catch { /* sin storage: vuelve a salir */ }
}

interface Props {
  /**
   * Recién con `true` se abre: la página lo habilita cuando se cerró el popup de vencimientos,
   * para no apilar dos diálogos.
   */
  habilitado: boolean
}

/**
 * Popup de `/gastos` con las promociones que **valen hoy** y todavía tienen tope por aprovechar,
 * y los **reintegros pendientes de usar** (saldo a favor con fecha de vencimiento). Mira siempre
 * el mes de hoy, no el período elegido en el dashboard. Sale una vez por día.
 */
export default function PromocionesHoyAlert({ habilitado }: Props) {
  const [hoy] = useState(hoyLocal)
  const [aviso, setAviso] = useState<ReturnType<typeof avisoPromociones<PromocionConProgreso, ReintegroPorVencer>> | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (yaVistoHoy(hoy)) return
    const [anio, mes] = hoy.split('-').map(Number)
    Promise.all([
      fetch(`/api/promociones?mes=${mes}&anio=${anio}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)),
      fetch('/api/promociones/vencimientos', { cache: 'no-store' }).then(r => (r.ok ? r.json() : [])),
    ])
      .then(([data, vencimientos]: [PromocionesResponse | null, ReintegroPorVencer[]]) => {
        const a = avisoPromociones(data?.promociones ?? [], vencimientos ?? [], hoy)
        if (a.mostrar) setAviso(a)
      })
      .catch(() => {})
  }, [hoy])

  useEffect(() => {
    if (habilitado && aviso) setOpen(true)
  }, [habilitado, aviso])

  if (!aviso) return null

  const cerrar = () => {
    marcarVisto(hoy)
    setOpen(false)
  }
  const dia = diaSemanaDeFecha(hoy)

  return (
    <Dialog open={open} onClose={cerrar} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
        <LocalOfferIcon /> Promociones
      </DialogTitle>
      <DialogContent dividers>
        {aviso.deHoy.length > 0 && (
          <Box sx={{ mb: aviso.saldos.length > 0 ? 2.5 : 0 }}>
            <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
              Vigentes hoy{dia != null ? `, ${DIAS_SEMANA[dia].toLowerCase()}` : ''}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {aviso.deHoy.map(p => (
                <Box
                  key={p.id}
                  sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}
                >
                  <Typography fontWeight={700}>{p.lugar}</Typography>
                  <Typography fontWeight={800} color="primary.main">{p.porcentaje}%</Typography>
                  <MediosPromo promo={p} size={20} />
                  <Typography variant="body2" color="text.secondary" sx={{ flexBasis: { xs: '100%', sm: 'auto' }, ml: { sm: 'auto' } }}>
                    Podés recuperar {fmtARS(p.progreso.disponible)} · gastando {fmtARS(p.progreso.gasto_restante)} más
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {aviso.saldos.length > 0 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
              <Typography variant="body2" fontWeight={700}>Saldo de reintegros para usar</Typography>
              <Typography variant="body2" fontWeight={800} color="primary.main">{fmtARS(aviso.saldoTotal)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {aviso.saldos.map(s => (
                <Box
                  key={`${s.promocion_id}-${s.anio}-${s.mes}`}
                  sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={700}>{s.lugar}</Typography>
                    <Typography variant="caption" color="text.secondary">de {MESES[s.mes - 1]} {s.anio}</Typography>
                  </Box>
                  <VencimientoChip venceEl={s.vence_el as string} hoy={hoy} />
                  <Typography fontWeight={800} color="primary.main" sx={{ ml: 'auto' }}>{fmtARS(s.reintegrado)}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button component={Link} href="/promociones" onClick={() => marcarVisto(hoy)}>Ver promociones</Button>
        <Button onClick={cerrar} variant="contained">Entendido</Button>
      </DialogActions>
    </Dialog>
  )
}
