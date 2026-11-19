'use client'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import EventIcon from '@mui/icons-material/Event'
import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout'
import { estadoVencimiento, ordenarPorVencimiento } from '@/lib/promociones-compute'
import type { LoteSaldoPromo, PromocionConProgreso } from '@/lib/types'
import VencimientoChip from './VencimientoChip'

const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

const fmtARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

interface Props {
  promos: PromocionConProgreso[]
  /** Fecha de hoy (`YYYY-MM-DD`, local). */
  hoy: string
  /** Cargar/cambiar el vencimiento de lo reintegrado en un ciclo. */
  onVencimiento: (promo: PromocionConProgreso, lote: LoteSaldoPromo) => void
  onUsarSaldo: (promo: PromocionConProgreso) => void
}

/**
 * Lo primero que se ve en la pantalla: el **saldo a favor** de cada promo (lo reintegrado que
 * todavía no se usó ni venció), la que vence antes arriba. Debajo de cada una, lo que queda de
 * cada ciclo con su vencimiento — el borde toma el color del más urgente. No depende del mes que
 * se esté mirando: el saldo de octubre puede vencer en diciembre.
 */
export default function SaldosReintegros({ promos, hoy, onVencimiento, onUsarSaldo }: Props) {
  const conSaldo = ordenarPorVencimiento(promos.filter(p => (p.saldo?.disponible ?? 0) > 0))
  if (conSaldo.length === 0) return null

  const total = conSaldo.reduce((s, p) => s + p.saldo.disponible, 0)
  const peor = estadoVencimiento(conSaldo[0].saldo.proximo_vencimiento?.vence_el, hoy)?.nivel
  const borde = peor === 'vencido' || peor === 'urgente' ? 'error.main' : peor === 'proximo' ? 'warning.main' : 'divider'

  return (
    <Card variant="outlined" sx={{ borderColor: borde, borderWidth: borde === 'divider' ? 1 : 2 }}>
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
          <AccountBalanceWalletIcon color={borde === 'error.main' ? 'error' : borde === 'warning.main' ? 'warning' : 'action'} />
          <Typography variant="subtitle1" fontWeight={800}>Saldo de reintegros para usar</Typography>
          <Typography variant="body2" fontWeight={800} color="primary.main">· {fmtARS(total)}</Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {conSaldo.map(p => (
            <Box key={p.id} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Typography fontWeight={700} sx={{ minWidth: 120 }}>{p.lugar}</Typography>
                <Typography fontWeight={800} color="primary.main">{fmtARS(p.saldo.disponible)}</Typography>
                <Button size="small" startIcon={<ShoppingCartCheckoutIcon />} onClick={() => onUsarSaldo(p)} sx={{ ml: 'auto' }}>
                  Usé saldo
                </Button>
              </Box>
              {p.saldo.lotes
                .filter(l => l.estado === 'disponible')
                .map(l => (
                  <Box key={`${l.anio}-${l.mes}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', pl: { sm: 2 } }}>
                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 150 }}>
                      {fmtARS(l.restante)} de {MESES[l.mes - 1]} {l.anio}
                      {l.usado > 0 ? ` (usaste ${fmtARS(l.usado)})` : ''}
                    </Typography>
                    {l.vence_el ? (
                      <VencimientoChip venceEl={l.vence_el} hoy={hoy} onClick={() => onVencimiento(p, l)} />
                    ) : (
                      <Button size="small" startIcon={<EventIcon />} onClick={() => onVencimiento(p, l)}>
                        Cargar vencimiento
                      </Button>
                    )}
                  </Box>
                ))}
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  )
}
