'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import LinkIcon from '@mui/icons-material/Link'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import EventIcon from '@mui/icons-material/Event'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { DIAS_CORTOS } from '@/lib/promociones-compute'
import type { PromocionConProgreso } from '@/lib/types'
import MediosPromo from './MediosPromo'
import VencimientoChip from './VencimientoChip'

const fmtARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const fmtFecha = (f: string) => f.split('-').reverse().join('/')

function vigenciaTexto(desde: string | null, hasta: string | null) {
  if (desde && hasta) return `${fmtFecha(desde)} → ${fmtFecha(hasta)}`
  return desde ? `Desde ${fmtFecha(desde)}` : `Hasta ${fmtFecha(hasta as string)}`
}

function Dato({ label, valor, color, ayuda }: { label: string; valor: string; color?: string; ayuda?: string }) {
  return (
    <Tooltip title={ayuda ?? ''} disableHoverListener={!ayuda}>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>{label}</Typography>
        <Typography variant="body1" fontWeight={700} color={color}>{valor}</Typography>
      </Box>
    </Tooltip>
  )
}

interface Props {
  promo: PromocionConProgreso
  hoy: number | null
  /** Fecha de hoy (`YYYY-MM-DD`, local) para medir cuánto falta al vencimiento del reintegro. */
  hoyFecha: string
  onVencimiento: () => void
  onUso: () => void
  onAsociar: () => void
  onEditar: () => void
  onBorrar: () => void
  onBorrarUso: (usoId: number) => void
}

/**
 * Una promo con lo que hace falta para decidir: cuánto gastaste, cuánto tenés que gastar en
 * total para llegar al tope, cuánto llevás reintegrado y cuánto te queda por ganar.
 */
export default function PromoCard({ promo, hoy, hoyFecha, onVencimiento, onUso, onAsociar, onEditar, onBorrar, onBorrarUso }: Props) {
  const [verUsos, setVerUsos] = useState(false)
  const p = promo.progreso
  const completa = p.estado === 'tope_alcanzado'

  return (
    <Card variant="outlined" sx={{ opacity: promo.activa && promo.vigente ? 1 : 0.55 }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h6" fontWeight={800} noWrap>{promo.lugar}</Typography>
              <Chip size="small" color={completa ? 'success' : 'primary'} label={`${promo.porcentaje}% · tope ${fmtARS(promo.tope_mensual)}`} />
              {!promo.activa && <Chip size="small" label="Inactiva" />}
              {promo.activa && !promo.vigente && <Chip size="small" label="Fuera de vigencia" />}
              {(promo.vigente_desde || promo.vigente_hasta) && (
                <Chip size="small" variant="outlined" label={vigenciaTexto(promo.vigente_desde, promo.vigente_hasta)} />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5, flexWrap: 'wrap' }}>
              <MediosPromo promo={promo} />
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {DIAS_CORTOS.map((d, i) => {
                  const vale = promo.dias.includes(i)
                  return (
                    <Typography
                      key={i}
                      variant="caption"
                      sx={{
                        px: 0.75, borderRadius: 1, fontWeight: vale ? 700 : 400,
                        color: vale ? (hoy === i ? 'primary.contrastText' : 'text.primary') : 'text.disabled',
                        bgcolor: vale ? (hoy === i ? 'primary.main' : 'action.selected') : 'transparent',
                      }}
                    >
                      {d}
                    </Typography>
                  )
                })}
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexShrink: 0 }}>
            <Tooltip title="Editar"><IconButton size="small" onClick={onEditar}><EditIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Eliminar"><IconButton size="small" onClick={onBorrar}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
          </Box>
        </Box>

        <Box>
          <LinearProgress
            variant="determinate"
            value={p.pct_tope}
            color={completa ? 'success' : 'primary'}
            sx={{ height: 10, borderRadius: 5 }}
          />
          <Typography variant="caption" color="text.secondary">
            {fmtARS(p.reintegrado)} de {fmtARS(promo.tope_mensual)} reintegrados ({p.pct_tope}%)
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 1.5 }}>
          <Dato
            label="Gastado"
            valor={fmtARS(p.consumo)}
            ayuda={`Automático ${fmtARS(p.consumo_auto)} + manual ${fmtARS(p.consumo_manual)}`}
          />
          <Dato
            label="Gasto mínimo p/ el tope"
            valor={fmtARS(p.gasto_minimo)}
            ayuda="Lo que hay que gastar en el mes para que el reintegro llegue justo al tope. Más no suma."
          />
          <Dato label="Reintegrado" valor={fmtARS(p.reintegrado)} color="success.main" />
          <Dato label="Por reintegrar" valor={fmtARS(p.disponible)} color={completa ? 'text.secondary' : 'primary.main'} />
        </Box>

        {(p.reintegrado > 0 || promo.reintegro) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary">Vencimiento del reintegro:</Typography>
            {promo.reintegro?.utilizado ? (
              <Chip
                size="small" color="success" variant="outlined" icon={<CheckCircleIcon />}
                label="Ya lo usé" onClick={onVencimiento}
              />
            ) : promo.reintegro?.vence_el ? (
              <VencimientoChip venceEl={promo.reintegro.vence_el} hoy={hoyFecha} onClick={onVencimiento} />
            ) : (
              <Button size="small" startIcon={<EventIcon />} onClick={onVencimiento}>Cargar fecha</Button>
            )}
          </Box>
        )}

        <Typography variant="body2" color={completa ? 'success.main' : 'text.secondary'} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {completa
            ? <><CheckCircleIcon sx={{ fontSize: 18 }} /> Tope alcanzado: no hace falta gastar más acá.</>
            : <>Te faltan gastar <b>{fmtARS(p.gasto_restante)}</b> para el reintegro máximo.</>}
        </Typography>

        {promo.concepto_ids.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            Sin conceptos vinculados: no se sugiere al cargar gastos. Sólo suma lo que registres a mano.
          </Typography>
        )}
        {promo.notas && <Typography variant="caption" color="text.secondary">{promo.notas}</Typography>}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {promo.concepto_ids.length > 0 && (
            <Button size="small" startIcon={<LinkIcon />} onClick={onAsociar}>Gastos que cuentan</Button>
          )}
          <Button size="small" startIcon={<AddIcon />} onClick={onUso}>Registrar uso</Button>
          {promo.usos.length > 0 && (
            <Button
              size="small"
              color="inherit"
              onClick={() => setVerUsos(v => !v)}
              endIcon={<ExpandMoreIcon sx={{ transform: verUsos ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />}
            >
              {promo.usos.length} {promo.usos.length === 1 ? 'uso manual' : 'usos manuales'}
            </Button>
          )}
        </Box>

        <Collapse in={verUsos} unmountOnExit>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {promo.usos.map(u => (
              <Box key={u.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="body2">
                  {u.fecha.split('-').reverse().join('/')} · {fmtARS(u.monto_gasto)}
                  {u.notas ? <Typography component="span" variant="caption" color="text.secondary"> — {u.notas}</Typography> : null}
                </Typography>
                <IconButton size="small" onClick={() => onBorrarUso(u.id)} aria-label="Quitar uso">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  )
}
