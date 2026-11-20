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
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout'
import { DIAS_CORTOS, textoFaltaTope, textoReintegro } from '@/lib/promociones-compute'
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
  onUsarSaldo: () => void
  onAsociar: () => void
  onEditar: () => void
  onBorrar: () => void
  onBorrarUso: (usoId: number) => void
  onBorrarSaldoUso: (usoId: number) => void
}

/**
 * Una promo con lo que hace falta para decidir: cuánto gastaste, cuánto tenés que gastar en
 * total para llegar al tope, cuánto llevás reintegrado y cuánto te queda por ganar en el ciclo,
 * y el saldo a favor acumulado (lo reintegrado que todavía no usaste ni venció).
 */
export default function PromoCard({
  promo, hoy, hoyFecha, onVencimiento, onUso, onUsarSaldo, onAsociar, onEditar, onBorrar, onBorrarUso, onBorrarSaldoUso,
}: Props) {
  const [verUsos, setVerUsos] = useState(false)
  const [verSaldoUsos, setVerSaldoUsos] = useState(false)
  const p = promo.progreso
  const saldo = promo.saldo
  const saldoUsos = promo.saldo_usos ?? []
  // Con reinicio el 1 el ciclo es el mes calendario y no hace falta mostrarlo.
  const cicloPropio = promo.dia_reinicio !== 1
  const completa = p.estado === 'tope_alcanzado'
  // Con algún criterio vinculado la promo se sugiere al cargar gastos y lista candidatos.
  const vinculada = promo.concepto_ids.length + promo.categoria_ids.length + promo.etiqueta_ids.length > 0

  return (
    <Card variant="outlined" sx={{ opacity: promo.activa && promo.vigente ? 1 : 0.55 }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h6" fontWeight={800} noWrap>{promo.lugar}</Typography>
              <Chip size="small" color={completa ? 'success' : 'primary'} label={`${textoReintegro(promo)} · tope ${fmtARS(promo.tope_mensual)}`} />
              {!promo.activa && <Chip size="small" label="Inactiva" />}
              {promo.activa && !promo.vigente && <Chip size="small" label="Fuera de vigencia" />}
              {(promo.vigente_desde || promo.vigente_hasta) && (
                <Chip size="small" variant="outlined" label={vigenciaTexto(promo.vigente_desde, promo.vigente_hasta)} />
              )}
              {cicloPropio && promo.ciclo && (
                <Tooltip title={`El tope se reinicia el ${promo.dia_reinicio} de cada mes`}>
                  <Chip
                    size="small"
                    variant="outlined"
                    color="info"
                    label={`Ciclo ${fmtFecha(promo.ciclo.desde).slice(0, 5)} → ${fmtFecha(promo.ciclo.hasta).slice(0, 5)}`}
                  />
                </Tooltip>
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
            ayuda={
              promo.tipo === 'monto_fijo'
                ? `Compras de la mínima que hacen falta en el ${cicloPropio ? 'ciclo' : 'mes'} para llegar al tope. Comprar más caro no devuelve más.`
                : `Lo que hay que gastar en el ${cicloPropio ? 'ciclo' : 'mes'} para que el reintegro llegue justo al tope. Más no suma.`
            }
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

        {saldo && (saldo.reintegrado > 0 || saldoUsos.length > 0) && (
          <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: 'action.hover', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <AccountBalanceWalletIcon fontSize="small" color={saldo.disponible > 0 ? 'primary' : 'disabled'} />
              <Typography variant="body2">
                Saldo a favor: <b>{fmtARS(saldo.disponible)}</b>
              </Typography>
              {saldo.proximo_vencimiento && (
                <Typography variant="caption" color="text.secondary">
                  · {fmtARS(saldo.proximo_vencimiento.monto)} vence el {fmtFecha(saldo.proximo_vencimiento.vence_el)}
                </Typography>
              )}
              {saldo.disponible > 0 && (
                <Button size="small" startIcon={<ShoppingCartCheckoutIcon />} onClick={onUsarSaldo} sx={{ ml: 'auto' }}>
                  Usé saldo
                </Button>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Reintegrado en total {fmtARS(saldo.reintegrado)} · usado {fmtARS(saldo.usado)}
              {saldo.vencido > 0 ? ` · vencido sin usar ${fmtARS(saldo.vencido)}` : ''}
              {saldo.sin_respaldo > 0 ? ` · usaste ${fmtARS(saldo.sin_respaldo)} más de lo que había` : ''}
            </Typography>
            {saldoUsos.length > 0 && (
              <>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => setVerSaldoUsos(v => !v)}
                  sx={{ alignSelf: 'flex-start' }}
                  endIcon={<ExpandMoreIcon sx={{ transform: verSaldoUsos ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />}
                >
                  {saldoUsos.length} {saldoUsos.length === 1 ? 'uso del saldo' : 'usos del saldo'}
                </Button>
                <Collapse in={verSaldoUsos} unmountOnExit>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {saldoUsos.map(u => (
                      <Box key={u.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Typography variant="body2">
                          {fmtFecha(u.fecha)} · {fmtARS(u.monto)}
                          {u.notas ? <Typography component="span" variant="caption" color="text.secondary"> — {u.notas}</Typography> : null}
                        </Typography>
                        <IconButton size="small" onClick={() => onBorrarSaldoUso(u.id)} aria-label="Quitar uso del saldo">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                </Collapse>
              </>
            )}
          </Box>
        )}

        <Typography variant="body2" color={completa ? 'success.main' : 'text.secondary'} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {completa
            ? <><CheckCircleIcon sx={{ fontSize: 18 }} /> Tope alcanzado: no hace falta gastar más acá.</>
            : promo.tipo === 'monto_fijo'
              ? <>Para el reintegro máximo, {textoFaltaTope(promo, p)}{p.compras_validas ? ` (llevás ${p.compras_validas} ${p.compras_validas === 1 ? 'compra válida' : 'compras válidas'})` : ''}.</>
              : <>Te faltan gastar <b>{fmtARS(p.gasto_restante)}</b> para el reintegro máximo.</>}
        </Typography>

        {!vinculada && (
          <Typography variant="caption" color="text.secondary">
            Sin conceptos, categorías ni etiquetas vinculados: no se sugiere al cargar gastos. Sólo suma lo que
            registres a mano.
          </Typography>
        )}
        {promo.notas && <Typography variant="caption" color="text.secondary">{promo.notas}</Typography>}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {vinculada && (
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
