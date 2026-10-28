'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { DIAS_CORTOS, DIAS_SEMANA, semanaPromos } from '@/lib/promociones-compute'
import type { PromocionConProgreso } from '@/lib/types'
import MediosPromo from './MediosPromo'

const fmtARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

/** Chip de una promo dentro de un día: qué, cuánto, con qué y cuánto queda por ganar. */
export function PromoChip({ promo, onClick }: { promo: PromocionConProgreso; onClick: () => void }) {
  const p = promo.progreso
  const completa = p.estado === 'tope_alcanzado'
  return (
    <Box
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        p: 1,
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: '4px solid',
        borderLeftColor: completa ? 'success.main' : 'primary.main',
        bgcolor: 'background.paper',
        opacity: completa ? 0.7 : 1,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="body2" fontWeight={700} noWrap>{promo.lugar}</Typography>
        <Typography variant="body2" fontWeight={800} color={completa ? 'success.main' : 'primary.main'}>
          {promo.porcentaje}%
        </Typography>
      </Box>
      <Box sx={{ mt: 0.5 }}>
        <MediosPromo promo={promo} size={18} />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
        {completa
          ? <><CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} /> Tope alcanzado</>
          : <>Quedan {fmtARS(p.disponible)}</>}
      </Typography>
    </Box>
  )
}

interface Props {
  promos: PromocionConProgreso[]
  /** Día de hoy (0 = lunes) para resaltarlo, o `null` si se mira otro mes. */
  hoy: number | null
  onSelect: (promo: PromocionConProgreso) => void
}

/**
 * La semana de un vistazo: una columna por día con las promos que valen ese día. En pantallas
 * chicas pasa a una lista vertical (siete columnas no entran en un celular) y los días sin
 * promo se reducen a una línea.
 */
export default function SemanaPromos({ promos, hoy, onSelect }: Props) {
  const semana = semanaPromos(promos)

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(7, minmax(0, 1fr))' },
        gap: 1,
      }}
    >
      {semana.map(({ dia, promos: delDia }) => {
        const esHoy = hoy === dia
        return (
          <Box
            key={dia}
            sx={{
              p: 1,
              borderRadius: 2,
              border: '1px solid',
              borderColor: esHoy ? 'primary.main' : 'divider',
              bgcolor: esHoy ? 'action.selected' : 'transparent',
              minHeight: { md: 120 },
            }}
          >
            <Typography variant="caption" fontWeight={800} color={esHoy ? 'primary.main' : 'text.secondary'} sx={{ textTransform: 'uppercase' }}>
              <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>{DIAS_CORTOS[dia]}</Box>
              <Box component="span" sx={{ display: { xs: 'inline', md: 'none' } }}>{DIAS_SEMANA[dia]}</Box>
              {esHoy && ' · hoy'}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.75 }}>
              {delDia.length === 0
                ? <Typography variant="caption" color="text.disabled">Sin promos</Typography>
                : delDia.map(p => <PromoChip key={p.id} promo={p} onClick={() => onSelect(p)} />)}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
