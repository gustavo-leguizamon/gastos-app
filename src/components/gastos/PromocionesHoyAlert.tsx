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
import type { PromocionConProgreso, PromocionesResponse } from '@/lib/types'

const fmtARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

function hoyLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
 * el mes de hoy, no el período elegido en el dashboard. Sale cada vez que se entra a la pantalla.
 */
export default function PromocionesHoyAlert({ habilitado }: Props) {
  const [hoy] = useState(hoyLocal)
  const [aviso, setAviso] = useState<ReturnType<typeof avisoPromociones<PromocionConProgreso>> | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const [anio, mes] = hoy.split('-').map(Number)
    // `actual=1`: el ciclo en curso de cada promo (respeta su día de reinicio), y el saldo a hoy.
    fetch(`/api/promociones?mes=${mes}&anio=${anio}&hoy=${hoy}&actual=1`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((data: PromocionesResponse | null) => {
        const a = avisoPromociones(data?.promociones ?? [], hoy)
        if (a.mostrar) setAviso(a)
      })
      .catch(() => {})
  }, [hoy])

  useEffect(() => {
    if (habilitado && aviso) setOpen(true)
  }, [habilitado, aviso])

  if (!aviso) return null

  const cerrar = () => setOpen(false)
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
              {aviso.saldos.map(p => {
                const prox = p.saldo.proximo_vencimiento
                return (
                  <Box
                    key={p.id}
                    sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={700}>{p.lugar}</Typography>
                      {prox && prox.monto < p.saldo.disponible && (
                        <Typography variant="caption" color="text.secondary">{fmtARS(prox.monto)} vence primero</Typography>
                      )}
                    </Box>
                    {prox && <VencimientoChip venceEl={prox.vence_el} hoy={hoy} />}
                    <Typography fontWeight={800} color="primary.main" sx={{ ml: 'auto' }}>{fmtARS(p.saldo.disponible)}</Typography>
                  </Box>
                )
              })}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button component={Link} href="/promociones">Ver promociones</Button>
        <Button onClick={cerrar} variant="contained">Entendido</Button>
      </DialogActions>
    </Dialog>
  )
}
