'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import AppTextField from '@/components/shared/AppTextField'
import PlataformaDialog from '@/components/divisas/PlataformaDialog'
import { fmtArs, fmtDivisa, fmtPct } from '@/components/divisas/formato'
import { compararPlataformas } from '@/lib/divisas-plataformas'
import type { Moneda, PlataformaDivisa } from '@/lib/types'

function comisionLabel(p: PlataformaDivisa, simbolo: string): string {
  if (!p.comision) return 'Sin comisión'
  const lado = p.comision_moneda === 'DIVISA' ? simbolo : 'ARS'
  return p.comision_tipo === 'PORCENTAJE' ? `${p.comision}% en ${lado}` : `${p.comision} ${lado} fijos`
}

function fechaCorta(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-AR')
}

export default function PlataformasDivisaPage() {
  const [monedas, setMonedas] = useState<Moneda[]>([])
  const [monedaId, setMonedaId] = useState<number | null>(null)
  const [plataformas, setPlataformas] = useState<PlataformaDivisa[]>([])
  const [monto, setMonto] = useState('1000000')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<PlataformaDivisa | null>(null)
  const [toDelete, setToDelete] = useState<PlataformaDivisa | null>(null)

  useEffect(() => {
    fetch('/api/monedas')
      .then((r) => r.json())
      .then((data: Moneda[]) => {
        const sinArs = data.filter((m) => m.codigo !== 'ARS')
        setMonedas(sinArs)
        setMonedaId((prev) => prev ?? sinArs.find((m) => m.codigo === 'USD')?.id ?? sinArs[0]?.id ?? null)
      })
      .catch(() => {})
  }, [])

  const load = useCallback(async (id: number) => {
    const rows = await fetch(`/api/divisas/plataformas?moneda_id=${id}`).then((r) => r.json())
    setPlataformas(rows)
  }, [])

  useEffect(() => {
    if (monedaId !== null) load(monedaId)
  }, [monedaId, load])

  const moneda = monedas.find((m) => m.id === monedaId) ?? null
  const simbolo = moneda?.simbolo ?? 'US$'
  const codigo = moneda?.codigo ?? ''

  const montoNum = Number(monto)
  const activas = useMemo(() => plataformas.filter((p) => p.activa), [plataformas])
  const inactivas = useMemo(() => plataformas.filter((p) => !p.activa), [plataformas])
  const resultados = useMemo(() => compararPlataformas(activas, montoNum), [activas, montoNum])

  const onDelete = async () => {
    if (!toDelete) return
    try {
      const res = await fetch(`/api/divisas/plataformas/${toDelete.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Plataforma eliminada')
      setToDelete(null)
      if (monedaId !== null) await load(monedaId)
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const acciones = (p: PlataformaDivisa) => (
    <Box sx={{ display: 'flex', flexShrink: 0 }}>
      <Tooltip title="Editar">
        <IconButton
          size="small"
          onClick={() => {
            setEditando(p)
            setDialogOpen(true)
          }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Eliminar">
        <IconButton size="small" onClick={() => setToDelete(p)}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  )

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Volver a Divisas">
            <IconButton component={Link} href="/divisas" size="small">
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          <Typography variant="h5" fontWeight={700}>Plataformas para comprar</Typography>
        </Box>
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditando(null)
            setDialogOpen(true)
          }}
          disabled={monedaId === null}
        >
          Plataforma
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Cargá a qué cotización vende cada plataforma y qué comisión cobra. Con el monto que
        pensás gastar se calcula cuánta divisa te queda en cada una y cuál conviene. La
        cotización cambia seguido: actualizala antes de decidir.
      </Typography>

      {monedas.length > 1 && (
        <Tabs
          value={monedaId ?? false}
          onChange={(_, v) => setMonedaId(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 2, minHeight: 40, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          {monedas.map((m) => (
            <Tab key={m.id} label={m.codigo} value={m.id} sx={{ minHeight: 40, textTransform: 'none' }} />
          ))}
        </Tabs>
      )}

      <AppTextField
        label="Monto a gastar (ARS)"
        type="number"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
        inputProps={{ step: 'any', min: 0 }}
        size="small"
        sx={{ mb: 2, maxWidth: 280 }}
        fullWidth
      />

      {activas.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Todavía no hay plataformas activas para {codigo}. Agregá la primera con el botón
              «Plataforma».
            </Typography>
          </CardContent>
        </Card>
      ) : !(montoNum > 0) ? (
        <Typography variant="body2" color="text.secondary">Ingresá un monto mayor a 0 para comparar.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {resultados.map((r) => {
            const p = r.plataforma
            return (
              <Card
                key={p.id}
                variant="outlined"
                sx={r.es_mejor ? { borderColor: 'success.main', borderWidth: 2 } : undefined}
              >
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle1" fontWeight={700}>{p.nombre}</Typography>
                        {r.es_mejor && (
                          <Chip size="small" color="success" icon={<EmojiEventsIcon />} label="La más conveniente" />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Vende a {fmtArs(p.cotizacion)} · {comisionLabel(p, simbolo)}
                        {p.updated_at ? ` · act. ${fechaCorta(p.updated_at)}` : ''}
                      </Typography>
                      {p.nota && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{p.nota}</Typography>
                      )}
                    </Box>
                    {acciones(p)}
                  </Box>

                  {r.divisa_obtenida === null ? (
                    <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                      El monto no alcanza para cubrir la comisión.
                    </Typography>
                  ) : (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
                        gap: 0.75,
                        pt: 1,
                        mt: 1,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Recibís</Typography>
                        <Typography variant="body1" fontWeight={700}>{fmtDivisa(r.divisa_obtenida, simbolo)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Cotización efectiva</Typography>
                        <Typography variant="body1" fontWeight={600}>{fmtArs(r.cotizacion_efectiva as number)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Comisión (en pesos)</Typography>
                        <Typography variant="body1">{fmtArs(r.comision_ars as number)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Contra la mejor</Typography>
                        <Typography
                          variant="body1"
                          sx={{ color: r.es_mejor ? 'success.main' : 'error.main' }}
                        >
                          {r.es_mejor
                            ? '—'
                            : `${fmtDivisa(-(r.divisa_menos as number), simbolo)} (${fmtPct(r.sobrecosto_pct)})`}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </Box>
      )}

      {inactivas.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Fuera de la comparación
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {inactivas.map((p) => (
              <Card key={p.id} variant="outlined" sx={{ opacity: 0.7 }}>
                <CardContent
                  sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{p.nombre}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {fmtArs(p.cotizacion)} · {comisionLabel(p, simbolo)}
                    </Typography>
                  </Box>
                  {acciones(p)}
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      )}

      {monedaId !== null && (
        <PlataformaDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSaved={() => load(monedaId)}
          monedaId={monedaId}
          codigo={codigo}
          editando={editando}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar plataforma"
        message={toDelete ? `¿Eliminar «${toDelete.nombre}»? Las operaciones ya cargadas no se tocan.` : ''}
        onConfirm={onDelete}
        onCancel={() => setToDelete(null)}
      />
    </Box>
  )
}
