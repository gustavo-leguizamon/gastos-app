'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import toast from 'react-hot-toast'
import AppTextField from '@/components/shared/AppTextField'
import AppSelect from '@/components/shared/AppSelect'
import AppMultiSelect from '@/components/shared/AppMultiSelect'
import { reajustar, MESES_HISTORICO_DEFAULT } from '@/lib/presupuestos-auto'
import type { Propuesta } from '@/lib/presupuestos-auto'
import type { BasePresupuesto } from '@/lib/presupuestos-base'
import type { Categoria, ObjetivoAhorro } from '@/lib/types'

interface Props {
  open: boolean
  mes: number
  anio: number
  categorias: Categoria[]
  /** Prefill de ingresos: los ya cargados del mes, o el promedio de los previos. */
  ingresosSugeridos: number
  /** Objetivo ya guardado del período: reabre el wizard con los mismos supuestos. */
  objetivo: ObjetivoAhorro | null
  /** Categorías con el tope fijado en el período, para prefillear las fijas. */
  fijadasIniciales: number[]
  onClose: () => void
  onAplicado: () => void
}

const MESES_OPCIONES = [2, 3, 6, 12].map(n => ({ value: n, label: `${n} meses` }))

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

const BASE_LABEL: Record<BasePresupuesto, string> = { devengado: 'Devengado', caja: 'Caja' }

const parseMonto = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'))

/**
 * Wizard de generación automática de presupuestos.
 *
 * Paso 1: el objetivo de ahorro y los supuestos. Paso 2: la propuesta, editable con
 * compensación automática — el reparto corre **en el cliente** (`reajustar`, la misma función
 * pura que testea el reparto) para que mover un tope sea instantáneo; recién al aplicar se
 * persiste. Sin eso, cada tecla sería un viaje a la DB.
 */
export default function GenerarPresupuestosDialog({
  open, mes, anio, categorias, ingresosSugeridos, objetivo, fijadasIniciales, onClose, onAplicado,
}: Props) {
  const [paso, setPaso] = useState<1 | 2>(1)
  const [objetivoStr, setObjetivoStr] = useState('')
  const [ingresosStr, setIngresosStr] = useState('')
  const [mesesHistorico, setMesesHistorico] = useState(MESES_HISTORICO_DEFAULT)
  const [fijas, setFijas] = useState<number[]>([])
  const [base, setBase] = useState<BasePresupuesto>('devengado')
  const [propuestas, setPropuestas] = useState<Record<BasePresupuesto, Propuesta> | null>(null)
  const [cargando, setCargando] = useState(false)
  const [aplicando, setAplicando] = useState(false)

  // Al abrir se arranca de los supuestos ya guardados (si el mes se generó antes) o de las
  // sugerencias del server. Reabrir y recalcular no debería obligar a re-tipear todo.
  useEffect(() => {
    if (!open) return
    setPaso(1)
    setPropuestas(null)
    setObjetivoStr(objetivo ? String(objetivo.monto) : '')
    setIngresosStr(String(objetivo?.ingresos_esperados ?? ingresosSugeridos ?? ''))
    setMesesHistorico(objetivo?.meses_historico ?? MESES_HISTORICO_DEFAULT)
    setBase(objetivo?.base ?? 'devengado')
    setFijas(fijadasIniciales)
  }, [open, objetivo, ingresosSugeridos, fijadasIniciales])

  const generar = useCallback(async () => {
    const objetivoNum = parseMonto(objetivoStr)
    const ingresosNum = parseMonto(ingresosStr)
    if (!Number.isFinite(objetivoNum) || objetivoNum < 0) { toast.error('Objetivo inválido'); return }
    if (!Number.isFinite(ingresosNum) || ingresosNum < 0) { toast.error('Ingresos esperados inválidos'); return }

    setCargando(true)
    try {
      const res = await fetch('/api/presupuestos/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mes, anio,
          objetivo: objetivoNum,
          ingresos_esperados: ingresosNum,
          meses_historico: mesesHistorico,
          categorias_fijas: fijas,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(d.error ?? 'No se pudo calcular'); return }
      setPropuestas(d.propuestas)
      setPaso(2)
    } finally {
      setCargando(false)
    }
  }, [objetivoStr, ingresosStr, mesesHistorico, fijas, mes, anio])

  const propuesta = propuestas?.[base] ?? null

  const editar = (categoriaId: number, monto: number) => {
    if (!propuestas) return
    const ajustada = reajustar(propuestas[base], categoriaId, monto)
    if (ajustada.no_absorbido > 0) {
      toast.error(`No hay de dónde compensar ${fmtARS(ajustada.no_absorbido)}: el objetivo ya no se cumple`)
    }
    setPropuestas({ ...propuestas, [base]: ajustada })
  }

  const alternarFijado = (categoriaId: number) => {
    if (!propuestas) return
    const actual = propuestas[base]
    setPropuestas({
      ...propuestas,
      [base]: {
        ...actual,
        filas: actual.filas.map(f => f.categoria_id === categoriaId ? { ...f, fijado: !f.fijado } : f),
      },
    })
  }

  const aplicar = async () => {
    if (!propuesta) return
    setAplicando(true)
    try {
      const res = await fetch('/api/presupuestos/aplicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mes, anio, base,
          objetivo: parseMonto(objetivoStr),
          ingresos_esperados: parseMonto(ingresosStr),
          meses_historico: mesesHistorico,
          filas: propuesta.filas.map(f => ({ categoria_id: f.categoria_id, monto: f.monto, fijado: f.fijado })),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(d.error ?? 'No se pudo aplicar'); return }
      toast.success(`${d.aplicados} tope(s) aplicado(s)`)
      onAplicado()
      onClose()
    } finally {
      setAplicando(false)
    }
  }

  const opcionesCategoria = useMemo(
    () => categorias.map(c => ({ value: c.id, label: c.nombre })),
    [categorias],
  )

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Generar presupuestos automáticamente
        <Typography variant="body2" color="text.secondary">
          {paso === 1
            ? 'Poné cuánto querés ahorrar y los topes salen del promedio de los meses anteriores.'
            : 'Ajustá lo que quieras: al subir una categoría, las demás bajan para que el objetivo se siga cumpliendo.'}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {paso === 1 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <AppTextField
                label="Objetivo de ahorro"
                value={objetivoStr}
                onChange={e => setObjetivoStr(e.target.value)}
                helperText="Cuánto querés que sobre este mes"
                sx={{ flex: 1 }}
                autoFocus
              />
              <AppTextField
                label="Ingresos esperados"
                value={ingresosStr}
                onChange={e => setIngresosStr(e.target.value)}
                helperText={
                  ingresosSugeridos > 0
                    ? `Sugerido: ${fmtARS(ingresosSugeridos)}`
                    : 'No hay ingresos cargados para estimarlo'
                }
                sx={{ flex: 1 }}
              />
            </Box>

            <AppSelect
              label="Promediar los últimos"
              options={MESES_OPCIONES}
              value={mesesHistorico}
              onChange={v => setMesesHistorico(Number(v) || MESES_HISTORICO_DEFAULT)}
              disableClearable
            />

            {/* Las fijas se reservan a su promedio: el recorte cae sólo sobre el resto. */}
            <AppMultiSelect
              label="Categorías fijas"
              options={opcionesCategoria}
              value={fijas}
              onChange={v => setFijas(v.map(Number))}
              helperText="No se ajustan: se reservan a su promedio y el recorte cae sobre las demás"
            />
          </Box>
        ) : propuesta ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">Base</Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={base}
                onChange={(_, v) => v && setBase(v as BasePresupuesto)}
              >
                <ToggleButton value="devengado">{BASE_LABEL.devengado}</ToggleButton>
                <ToggleButton value="caja">{BASE_LABEL.caja}</ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary">
                Se aplica la propuesta de la base elegida
              </Typography>
            </Box>

            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
              gap: 1.5,
            }}>
              <Resumen label="Ingresos" valor={fmtARS(parseMonto(ingresosStr) || 0)} />
              <Resumen label="Objetivo de ahorro" valor={fmtARS(parseMonto(objetivoStr) || 0)} />
              <Resumen label="Disponible" valor={fmtARS(propuesta.disponible)} />
              <Resumen
                label={propuesta.estado === 'imposible' ? 'Falta recortar' : 'Sin asignar'}
                valor={fmtARS(propuesta.estado === 'imposible' ? propuesta.faltante : propuesta.colchon)}
                color={propuesta.estado === 'imposible' ? '#ef4444' : propuesta.colchon > 0 ? '#f59e0b' : '#22c55e'}
              />
            </Box>

            {propuesta.estado === 'imposible' && (
              <Alert severity="error">
                Con los gastos fijos y lo que se pudo recortar, el objetivo se pasa por{' '}
                {fmtARS(propuesta.faltante)}. Bajá el objetivo, subí los ingresos esperados o sacá
                alguna categoría de las fijas.
              </Alert>
            )}
            {propuesta.estado === 'holgado' && (
              <Alert severity="info">
                Con los promedios sobran {fmtARS(propuesta.colchon)} por encima del objetivo. Los topes
                se dejan en el promedio en vez de inflarse: vas a ahorrar de más.
              </Alert>
            )}
            {propuesta.filas.length === 0 && (
              <Alert severity="warning">
                No hay histórico en los meses anteriores para proponer topes. Cargalos a mano desde la
                pantalla de presupuestos.
              </Alert>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {propuesta.filas.map(f => (
                <Box
                  key={f.categoria_id}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
                >
                  <Typography sx={{ flex: 1, minWidth: 120 }}>{f.categoria_nombre}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 130 }}>
                    Promedio {fmtARS(f.promedio)}
                  </Typography>
                  <MontoEditable valor={f.monto} onChange={m => editar(f.categoria_id, m)} />
                  <Tooltip title={f.fijado ? 'No se ajusta al compensar' : 'Se ajusta al compensar'}>
                    <IconButton size="small" onClick={() => alternarFijado(f.categoria_id)}>
                      {f.fijado ? <LockIcon fontSize="small" color="primary" /> : <LockOpenIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Box>
          </Box>
        ) : null}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        {paso === 2 && <Button onClick={() => setPaso(1)}>Volver</Button>}
        {paso === 1 ? (
          <Button variant="contained" onClick={generar} disabled={cargando}>
            {cargando ? <CircularProgress size={20} /> : 'Calcular'}
          </Button>
        ) : (
          <Tooltip title="Reemplaza todos los topes cargados en el período">
            <span>
              <Button
                variant="contained"
                onClick={aplicar}
                disabled={aplicando || !propuesta || propuesta.filas.length === 0}
              >
                {aplicando ? <CircularProgress size={20} /> : 'Aplicar y reemplazar'}
              </Button>
            </span>
          </Tooltip>
        )}
      </DialogActions>
    </Dialog>
  )
}

function Resumen({ label, valor, color }: { label: string; valor: string; color?: string }) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.25 }}>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography fontWeight={700} sx={{ color }}>{valor}</Typography>
    </Box>
  )
}

/**
 * Monto editable de una fila. Mantiene el texto tipeado en estado propio y sólo propaga al
 * confirmar: el reparto reescribe todas las demás filas, y hacerlo en cada tecla haría saltar
 * los números mientras se escribe.
 */
function MontoEditable({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  const [texto, setTexto] = useState(String(valor))
  useEffect(() => { setTexto(String(valor)) }, [valor])

  const confirmar = () => {
    const n = parseMonto(texto)
    if (!Number.isFinite(n) || n < 0) { setTexto(String(valor)); return }
    if (n !== valor) onChange(n)
  }

  return (
    <AppTextField
      size="small"
      value={texto}
      onChange={e => setTexto(e.target.value)}
      onBlur={confirmar}
      onKeyDown={e => {
        if (e.key === 'Enter') confirmar()
        if (e.key === 'Escape') setTexto(String(valor))
      }}
      sx={{ width: 140 }}
    />
  )
}
