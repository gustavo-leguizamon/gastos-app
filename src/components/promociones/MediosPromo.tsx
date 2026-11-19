'use client'

import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import PaymentsIcon from '@mui/icons-material/Payments'
import StorefrontIcon from '@mui/icons-material/Storefront'
import LanguageIcon from '@mui/icons-material/Language'
import BancoLogo from '@/components/shared/BancoLogo'
import TarjetaLogo from '@/components/shared/TarjetaLogo'
import { hasBancoIcono } from '@/lib/bancos'
import type { Promocion, PromocionTarjeta } from '@/lib/types'

/** Logo de una tarjeta: el del banco si hay (o se puede inferir), si no la marca. */
export function TarjetaIcono({ t, size = 20 }: { t: PromocionTarjeta; size?: number }) {
  const conBanco = hasBancoIcono(t.banco_icono, t.banco_logo, t.banco)
  return (
    <Tooltip title={t.nombre}>
      <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
        {conBanco
          ? <BancoLogo banco={t.banco_logo} icono={t.banco_icono} bancoTexto={t.banco} size={size} />
          : <TarjetaLogo marca={t.marca} size={size} />}
      </Box>
    </Tooltip>
  )
}

/** Los medios con los que vale una promo: un logo por tarjeta y un billete si vale en efectivo. */
export default function MediosPromo({ promo, size = 20 }: { promo: Pick<Promocion, 'tarjetas' | 'efectivo' | 'modalidad'>; size?: number }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
      {promo.tarjetas.map(t => <TarjetaIcono key={t.id} t={t} size={size} />)}
      {promo.efectivo && (
        <Tooltip title="Débito / Efectivo">
          <PaymentsIcon sx={{ fontSize: size, color: 'success.main' }} />
        </Tooltip>
      )}
      {promo.modalidad !== 'virtual' && (
        <Tooltip title="Presencial"><StorefrontIcon sx={{ fontSize: size, color: 'text.secondary' }} /></Tooltip>
      )}
      {promo.modalidad !== 'presencial' && (
        <Tooltip title="Virtual"><LanguageIcon sx={{ fontSize: size, color: 'info.main' }} /></Tooltip>
      )}
    </Box>
  )
}
