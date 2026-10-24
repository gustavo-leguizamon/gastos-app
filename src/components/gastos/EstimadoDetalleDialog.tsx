'use client'

import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import InputAdornment from '@mui/material/InputAdornment'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableFooter from '@mui/material/TableFooter'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import SearchIcon from '@mui/icons-material/Search'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { CriterioEstimado, EstimadoDetalle, EstimadoHistorico } from '@/lib/types'

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const COLOR_ESTIMADO = '#06b6d4'

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

const CRITERIOS: Record<CriterioEstimado, { label: string; ayuda: string; color: 'default' | 'info' | 'warning'; nota?: string }> = {
  promedio: { label: 'Promedio', ayuda: 'Promedio de este mes con los meses previos', color: 'default' },
  cuota_vigente: {
    label: 'Cuota',
    ayuda: 'En cuotas y no es la última: se suma el monto tal cual',
    color: 'info',
    nota: 'No se promedia: suma la cuota tal cual',
  },
  ultima_cuota: {
    label: 'Última cuota',
    ayuda: 'Es la última cuota: no aporta al mes siguiente',
    color: 'warning',
    nota: 'Última cuota: no aporta al mes siguiente',
  },
}

// Gasto, Criterio y Estimado quedan fijas a la izquierda: al scrollear el histórico siempre se ve
// qué fila es y cuánto aportó. Necesitan ancho fijo para saber dónde arranca cada una, y fondo
// sólido para tapar lo que pasa por debajo.
const ANCHO_GASTO = 230
const ANCHO_CRITERIO = 110
const ANCHO_ESTIMADO = 140
const fija = (left: number, width: number, ultima = false) => ({
  position: 'sticky',
  left,
  width,
  minWidth: width,
  maxWidth: width,
  zIndex: 2,
  bgcolor: 'background.paper',
  ...(ultima && { borderRight: 1, borderRightColor: 'divider' }),
}) as const
const COL_GASTO = fija(0, ANCHO_GASTO)
const COL_CRITERIO = fija(ANCHO_GASTO, ANCHO_CRITERIO)
const COL_ESTIMADO = fija(ANCHO_GASTO + ANCHO_CRITERIO, ANCHO_ESTIMADO, true)
// Header y total son sticky arriba/abajo: las celdas fijas tienen que quedar por encima de todo.
const ESQUINA = { zIndex: 4 }
const BORDE_MES = { borderLeft: 1, borderLeftColor: 'divider' }
// El total queda pegado abajo, separado del cuerpo.
const PIE = {
  position: 'sticky',
  bottom: 0,
  zIndex: 3,
  bgcolor: 'background.paper',
  borderTop: 2,
  borderTopColor: 'divider',
  borderBottom: 0,
  fontWeight: 700,
  fontSize: '0.875rem',
  color: 'text.primary',
} as const

function CeldaHistorico({ h }: { h: EstimadoHistorico | undefined }) {
  if (!h) return <TableCell />
  if (h.monto !== null) return <TableCell align="right">{fmtARS(h.monto)}</TableCell>
  return (
    <TableCell align="right">
      <Tooltip title={h.en_promedio ? 'No estaba ese mes: cuenta como $ 0' : 'No estaba ese mes: no entra al promedio'}>
        <Typography variant="body2" component="span" color="text.disabled" sx={{ fontStyle: 'italic' }}>
          {h.en_promedio ? fmtARS(0) : '—'}
        </Typography>
      </Tooltip>
    </TableCell>
  )
}

/** Segunda línea de una fila: de dónde sale, cuántos se sumaron y la cuota. */
function contextoDe(d: EstimadoDetalle) {
  return [
    d.gasto_padre && (d.cantidad > 1 ? `${d.cantidad} sub-items de ${d.gasto_padre}` : `Sub-item de ${d.gasto_padre}`),
    !d.gasto_padre && d.cantidad > 1 && `${d.cantidad} gastos sumados`,
    d.cuota_actual != null && `Cuota ${d.cuota_actual}/${d.cuotas_totales}`,
  ].filter(Boolean).join(' · ')
}

const etiquetaMes = (h: EstimadoHistorico, i: number) => (h.mes ? `${MESES_CORTOS[h.mes - 1]} ${h.anio}` : `Mes −${i + 1}`)

/**
 * Card de una fila en mobile: concepto, criterio, estimado y monto del mes a la vista. Si se promedia,
 * al tocarla despliega el histórico con una barra por mes, escalada al mayor monto de la fila
 * (incluido el de este mes) para comparar de un vistazo; los negativos van en rojo.
 */
function TarjetaMobile({ d }: { d: EstimadoDetalle }) {
  const [abierta, setAbierta] = useState(false)
  const criterio = CRITERIOS[d.criterio]
  const contexto = contextoDe(d)
  const expandible = d.historico.length > 0
  const maximo = Math.max(Math.abs(d.monto_actual), ...d.historico.map((h) => Math.abs(h.monto ?? 0)), 1)

  const cabecera = (
    <Box sx={{ p: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>{d.descripcion || '(sin concepto)'}</Typography>
          {contexto && <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{contexto}</Typography>}
        </Box>
        <Typography
          variant="body2"
          fontWeight={700}
          sx={{ whiteSpace: 'nowrap', color: d.criterio === 'ultima_cuota' ? 'text.disabled' : COLOR_ESTIMADO }}
        >
          {fmtARS(d.estimado)}
        </Typography>
        {expandible && (
          <ExpandMoreIcon
            fontSize="small"
            sx={{ color: 'text.secondary', transition: 'transform .2s', transform: abierta ? 'rotate(180deg)' : 'none' }}
          />
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
        <Chip size="small" label={criterio.label} color={criterio.color} variant="outlined" />
        <Typography variant="caption" color="text.secondary">
          Este mes <strong>{fmtARS(d.monto_actual)}</strong>
        </Typography>
      </Box>
      {criterio.nota && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
          {criterio.nota}
        </Typography>
      )}
    </Box>
  )

  return (
    <Card variant="outlined" sx={{ backgroundImage: 'none' }}>
      {expandible ? <CardActionArea onClick={() => setAbierta((v) => !v)}>{cabecera}</CardActionArea> : cabecera}
      {expandible && (
        <Collapse in={abierta} unmountOnExit>
          <Box sx={{ px: 1.5, pb: 1.5, pt: 1, borderTop: 1, borderColor: 'divider', display: 'grid', gap: 0.75 }}>
            {d.historico.map((h, i) => {
              const sinDato = h.monto === null
              const monto = h.monto ?? 0
              return (
                <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">{etiquetaMes(h, i)}</Typography>
                  <Box sx={{ height: 8, borderRadius: 4, bgcolor: 'action.hover', overflow: 'hidden' }}>
                    <Box
                      sx={{
                        height: '100%',
                        width: `${(Math.abs(monto) / maximo) * 100}%`,
                        bgcolor: monto < 0 ? 'error.main' : COLOR_ESTIMADO,
                        borderRadius: 4,
                      }}
                    />
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ textAlign: 'right', minWidth: 88, ...(sinDato && { color: 'text.disabled', fontStyle: 'italic' }) }}
                  >
                    {sinDato ? (h.en_promedio ? `${fmtARS(0)} (no estaba)` : '— no promedia') : fmtARS(monto)}
                  </Typography>
                </Box>
              )
            })}
          </Box>
        </Collapse>
      )}
    </Card>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  detalle: EstimadoDetalle[]
  total: number
}

/** Desglose de la card "Estimado próximo mes": qué aportó cada gasto y por qué. */
export default function EstimadoDetalleDialog({ open, onClose, detalle, total }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [busqueda, setBusqueda] = useState('')

  // Al volver a abrir, mostrar todo.
  useEffect(() => { if (!open) setBusqueda('') }, [open])

  // Las columnas del histórico salen de cualquier fila promediada (todas tienen los mismos meses).
  const meses = detalle.find((d) => d.historico.length > 0)?.historico ?? []

  const texto = busqueda.trim().toLowerCase()
  const filas = texto
    ? detalle.filter((d) => `${d.descripcion} ${d.gasto_padre ?? ''}`.toLowerCase().includes(texto))
    : detalle
  const subtotal = filas.reduce((s, d) => s + d.estimado, 0)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      fullScreen={isMobile}
      // Sin el overlay de elevación del modo oscuro, el fondo del papel es exactamente
      // `background.paper` y las celdas fijas no se ven de otro tono.
      PaperProps={{ sx: { backgroundImage: 'none', ...(!isMobile && { height: '90vh' }) } }}
    >
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        Detalle del estimado próximo mes
        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
          Lo que aportó cada concepto del mes al total. Los criterios se configuran en{' '}
          <strong>Configuración → Estimación próximo mes</strong>.
        </Typography>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, overflow: 'hidden', p: { xs: 1.5, sm: 2 } }}
      >
        {isMobile && (
          // En mobile el total va arriba (no hay pie de tabla) y queda fijo: sólo la lista scrollea.
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">{texto ? 'Subtotal filtrado' : 'Total'}</Typography>
            <Typography variant="h6" fontWeight={700} sx={{ color: COLOR_ESTIMADO }}>
              {fmtARS(texto ? subtotal : total)}
            </Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Buscar concepto o tarjeta"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            sx={{ width: { xs: '100%', sm: 280 } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
          <Typography variant="body2" color="text.secondary">
            {filas.length} de {detalle.length} conceptos
          </Typography>
        </Box>

        {detalle.length === 0 ? (
          <Typography color="text.secondary">No hay gastos que entren en el estimado.</Typography>
        ) : isMobile ? (
          // Mobile: cards en vez de tabla (convención de la app, ver docs/claude/auth-pwa.md).
          // Bloque común, no grid/flex: con alto fijo, un grid achica a 0 las cards (tienen
          // `overflow: hidden`, así que su mínimo es 0) en vez de scrollear.
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', '& > :not(:last-child)': { mb: 1 } }}>
            {filas.map((d, idx) => <TarjetaMobile key={`${d.es_subitem ? 's' : 'g'}-${d.concepto_id}-${idx}`} d={d} />)}
            {filas.length === 0 && (
              <Typography variant="body2" color="text.secondary">Ningún concepto coincide con la búsqueda.</Typography>
            )}
          </Box>
        ) : (
          // Único contenedor de scroll (ambos ejes): el header y el total quedan siempre a la vista
          // y la barra horizontal está siempre abajo, no al final de la tabla.
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...COL_GASTO, ...ESQUINA }}>Gasto</TableCell>
                  <TableCell sx={{ ...COL_CRITERIO, ...ESQUINA }}>Criterio</TableCell>
                  <TableCell align="right" sx={{ ...COL_ESTIMADO, ...ESQUINA }}>Estimado</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Este mes</TableCell>
                  {meses.map((m, i) => (
                    <TableCell key={i} align="right" sx={{ whiteSpace: 'nowrap', ...(i === 0 && BORDE_MES) }}>
                      {etiquetaMes(m, i)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filas.map((d, idx) => {
                  const criterio = CRITERIOS[d.criterio]
                  const contexto = contextoDe(d)
                  return (
                    <TableRow key={`${d.es_subitem ? 's' : 'g'}-${d.concepto_id}-${idx}`}>
                      <TableCell sx={COL_GASTO}>
                        <Typography variant="body2" fontWeight={500} noWrap title={d.descripcion}>
                          {d.descripcion || '(sin concepto)'}
                        </Typography>
                        {contexto && (
                          <Typography variant="caption" color="text.secondary" noWrap title={contexto} sx={{ display: 'block' }}>
                            {contexto}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={COL_CRITERIO}>
                        <Tooltip title={criterio.ayuda}>
                          <Chip size="small" label={criterio.label} color={criterio.color} variant="outlined" />
                        </Tooltip>
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          ...COL_ESTIMADO,
                          fontWeight: 700,
                          color: d.criterio === 'ultima_cuota' ? 'text.disabled' : COLOR_ESTIMADO,
                        }}
                      >
                        {fmtARS(d.estimado)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 500 }}>{fmtARS(d.monto_actual)}</TableCell>
                      {meses.length > 0 && criterio.nota ? (
                        // Las cuotas no se promedian: una sola celda que lo dice, en vez de columnas vacías.
                        <TableCell colSpan={meses.length} sx={BORDE_MES}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            {criterio.nota}
                          </Typography>
                        </TableCell>
                      ) : (
                        meses.map((_, i) => <CeldaHistorico key={i} h={d.historico[i]} />)
                      )}
                    </TableRow>
                  )
                })}
                {filas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4 + meses.length}>
                      <Typography variant="body2" color="text.secondary">Ningún concepto coincide con la búsqueda.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell sx={{ ...PIE, ...COL_GASTO, ...ESQUINA }}>
                    {texto ? 'Subtotal filtrado' : 'Total'}
                  </TableCell>
                  <TableCell sx={{ ...PIE, ...COL_CRITERIO, ...ESQUINA }} />
                  <TableCell align="right" sx={{ ...PIE, ...COL_ESTIMADO, ...ESQUINA, color: COLOR_ESTIMADO }}>
                    {fmtARS(texto ? subtotal : total)}
                  </TableCell>
                  <TableCell colSpan={1 + meses.length} sx={{ ...PIE, fontWeight: 400 }}>
                    {texto && (
                      <Typography variant="caption" color="text.secondary">
                        Total del estimado: {fmtARS(total)}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}
