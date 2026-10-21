'use client'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import type { CriterioEstimado, EstimadoDetalle, EstimadoHistorico } from '@/lib/types'

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

const CRITERIOS: Record<CriterioEstimado, { label: string; ayuda: string; color: 'default' | 'info' | 'warning' }> = {
  promedio: { label: 'Promedio', ayuda: 'Promedio de este mes con los meses previos', color: 'default' },
  cuota_vigente: { label: 'Cuota', ayuda: 'En cuotas y no es la última: se suma el monto tal cual', color: 'info' },
  ultima_cuota: { label: 'Última cuota', ayuda: 'Es la última cuota: no aporta al mes siguiente', color: 'warning' },
}

// Las dos primeras columnas (Gasto y Criterio) quedan fijas al scrollear horizontalmente.
// Necesitan ancho fijo para saber dónde arranca la segunda, y fondo sólido para tapar lo que pasa por debajo.
const ANCHO_GASTO = 180
const ANCHO_CRITERIO = 120
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
const COL_CRITERIO = fija(ANCHO_GASTO, ANCHO_CRITERIO, true)
// En el header la celda fija también es sticky arriba: tiene que quedar por encima de ambas.
const HEAD_FIJA = { zIndex: 3 }

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

  // Las columnas del histórico salen de cualquier fila promediada (todas tienen los mismos meses).
  const meses = detalle.find((d) => d.historico.length > 0)?.historico ?? []

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ fontWeight: 700 }}>Detalle del estimado próximo mes</DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Cada fila es un gasto del mes (o un grupo de sub-items del mismo concepto) con lo que aportó al
          total. Los criterios se configuran en <strong>Configuración → Estimación próximo mes</strong>.
        </Typography>

        {detalle.length === 0 ? (
          <Typography color="text.secondary">No hay gastos que entren en el estimado.</Typography>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...COL_GASTO, ...HEAD_FIJA }}>Gasto</TableCell>
                  <TableCell sx={{ ...COL_CRITERIO, ...HEAD_FIJA }}>Criterio</TableCell>
                  <TableCell align="right">Este mes</TableCell>
                  {meses.map((m, i) => (
                    <TableCell key={i} align="right">
                      {m.mes ? `${MESES_CORTOS[m.mes - 1]} ${m.anio}` : `Mes −${i + 1}`}
                    </TableCell>
                  ))}
                  <TableCell align="right">Estimado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {detalle.map((d, idx) => {
                  const criterio = CRITERIOS[d.criterio]
                  // Segunda línea: de dónde sale la fila, cuántos se sumaron y la cuota.
                  const contexto = [
                    d.gasto_padre && (d.cantidad > 1 ? `${d.cantidad} sub-items de ${d.gasto_padre}` : `Sub-item de ${d.gasto_padre}`),
                    !d.gasto_padre && d.cantidad > 1 && `${d.cantidad} gastos sumados`,
                    d.cuota_actual != null && `Cuota ${d.cuota_actual}/${d.cuotas_totales}`,
                  ].filter(Boolean).join(' · ')
                  return (
                    <TableRow key={`${d.es_subitem ? 's' : 'g'}-${d.concepto_id}-${idx}`} hover>
                      <TableCell sx={COL_GASTO}>
                        <Typography variant="body2" fontWeight={500}>{d.descripcion || '(sin concepto)'}</Typography>
                        {contexto && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {contexto}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={COL_CRITERIO}>
                        <Tooltip title={criterio.ayuda}>
                          <Chip size="small" label={criterio.label} color={criterio.color} variant="outlined" />
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">{fmtARS(d.monto_actual)}</TableCell>
                      {meses.map((_, i) => <CeldaHistorico key={i} h={d.historico[i]} />)}
                      <TableCell
                        align="right"
                        sx={{ fontWeight: 700, color: d.criterio === 'ultima_cuota' ? 'text.disabled' : '#06b6d4' }}
                      >
                        {fmtARS(d.estimado)}
                      </TableCell>
                    </TableRow>
                  )
                })}
                <TableRow>
                  <TableCell sx={{ ...COL_GASTO, fontWeight: 700 }}>Total</TableCell>
                  <TableCell sx={COL_CRITERIO} />
                  <TableCell colSpan={1 + meses.length} />
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#06b6d4' }}>{fmtARS(total)}</TableCell>
                </TableRow>
              </TableBody>
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
