'use client'

import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
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
        <Typography variant="body2" color="text.secondary">
          Lo que aportó cada concepto del mes al total. Los criterios se configuran en{' '}
          <strong>Configuración → Estimación próximo mes</strong>.
        </Typography>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, overflow: 'hidden', p: { xs: 1.5, sm: 2 } }}
      >
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
                      {m.mes ? `${MESES_CORTOS[m.mes - 1]} ${m.anio}` : `Mes −${i + 1}`}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filas.map((d, idx) => {
                  const criterio = CRITERIOS[d.criterio]
                  // Segunda línea: de dónde sale la fila, cuántos se sumaron y la cuota.
                  const contexto = [
                    d.gasto_padre && (d.cantidad > 1 ? `${d.cantidad} sub-items de ${d.gasto_padre}` : `Sub-item de ${d.gasto_padre}`),
                    !d.gasto_padre && d.cantidad > 1 && `${d.cantidad} gastos sumados`,
                    d.cuota_actual != null && `Cuota ${d.cuota_actual}/${d.cuotas_totales}`,
                  ].filter(Boolean).join(' · ')
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
