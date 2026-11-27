'use client'

import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import PaymentsIcon from '@mui/icons-material/Payments'
import StorefrontIcon from '@mui/icons-material/Storefront'
import LanguageIcon from '@mui/icons-material/Language'
import TarjetaConMarca from '@/components/shared/TarjetaConMarca'
import type { Promocion } from '@/lib/types'

/** Los medios con los que vale una promo: un logo por tarjeta y un billete si vale en efectivo. */
export default function MediosPromo({ promo, size = 20 }: { promo: Pick<Promocion, 'tarjetas' | 'efectivo' | 'modalidad'>; size?: number }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
      {promo.tarjetas.map(t => <TarjetaConMarca key={t.id} t={t} size={size} />)}
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
