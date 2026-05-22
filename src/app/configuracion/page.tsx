'use client'

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import IconButton from '@mui/material/IconButton'
import TextField from '@/components/shared/AppTextField'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import AppToggle from '@/components/shared/AppToggle'
import Tooltip from '@mui/material/Tooltip'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import toast from 'react-hot-toast'
import type { Casa, Categoria, Moneda, Tarjeta } from '@/lib/types'

function useSimpleCrud<T extends { id: number }>(endpoint: string) {
  const [items, setItems] = useState<T[]>([])

  const load = () => fetch(endpoint).then(r => r.json()).then(setItems)
  useEffect(() => { load() }, [])

  const add = async (body: object) => {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) throw new Error()
    await load()
  }

  const update = async (id: number, body: object) => {
    const res = await fetch(`${endpoint}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) throw new Error()
    await load()
  }

  const remove = async (id: number) => {
    await fetch(`${endpoint}/${id}`, { method: 'DELETE' })
    await load()
  }

  return { items, add, update, remove }
}

export default function ConfiguracionPage() {
  // Casas
  const { items: casas, add: addCasa, update: updateCasa, remove: removeCasa } = useSimpleCrud<Casa>('/api/casas')
  const [nuevaCasa, setNuevaCasa] = useState('')
  const [editingCasa, setEditingCasa] = useState<{ id: number; nombre: string } | null>(null)

  // Monedas
  const { items: monedas, add: addMoneda, update: updateMoneda, remove: removeMoneda } = useSimpleCrud<Moneda>('/api/monedas')
  const [nuevaMoneda, setNuevaMoneda] = useState({ codigo: '', nombre: '', simbolo: '' })
  const [editingMoneda, setEditingMoneda] = useState<Moneda | null>(null)

  // Tarjetas
  const { items: tarjetas, add: addTarjeta, update: updateTarjeta, remove: removeTarjeta } = useSimpleCrud<Tarjeta>('/api/tarjetas')
  const [nuevaTarjeta, setNuevaTarjeta] = useState({ nombre: '', banco: '' })
  const [editingTarjeta, setEditingTarjeta] = useState<Tarjeta | null>(null)

  // Categorias
  const { items: categorias, add: addCategoria, update: updateCategoria, remove: removeCategoria } = useSimpleCrud<Categoria>('/api/categorias')
  const [nuevoCategoria, setNuevoCategoria] = useState('')
  const [editingCategoria, setEditingCategoria] = useState<{ id: number; nombre: string } | null>(null)

  const handleAddCasa = async () => {
    if (!nuevaCasa.trim()) return
    try { await addCasa({ nombre: nuevaCasa.trim() }); setNuevaCasa(''); toast.success('Casa agregada') }
    catch { toast.error('Error al agregar casa') }
  }

  const handleSaveCasa = async () => {
    if (!editingCasa || !editingCasa.nombre.trim()) return
    try { await updateCasa(editingCasa.id, { nombre: editingCasa.nombre.trim() }); setEditingCasa(null); toast.success('Casa actualizada') }
    catch { toast.error('Error al actualizar casa') }
  }

  const handleAddMoneda = async () => {
    if (!nuevaMoneda.codigo || !nuevaMoneda.nombre || !nuevaMoneda.simbolo) return
    try { await addMoneda(nuevaMoneda); setNuevaMoneda({ codigo: '', nombre: '', simbolo: '' }); toast.success('Moneda agregada') }
    catch { toast.error('Error al agregar moneda') }
  }

  const handleSaveMoneda = async () => {
    if (!editingMoneda || !editingMoneda.codigo || !editingMoneda.nombre || !editingMoneda.simbolo) return
    try { await updateMoneda(editingMoneda.id, editingMoneda); setEditingMoneda(null); toast.success('Moneda actualizada') }
    catch { toast.error('Error al actualizar moneda') }
  }

  const handleAddCategoria = async () => {
    if (!nuevoCategoria.trim()) return
    try { await addCategoria({ nombre: nuevoCategoria.trim() }); setNuevoCategoria(''); toast.success('Categoría agregada') }
    catch { toast.error('Error al agregar categoría') }
  }

  const handleSaveCategoria = async () => {
    if (!editingCategoria || !editingCategoria.nombre.trim()) return
    try { await updateCategoria(editingCategoria.id, { nombre: editingCategoria.nombre.trim() }); setEditingCategoria(null); toast.success('Categoría actualizada') }
    catch { toast.error('Error al actualizar categoría') }
  }

  const handleAddTarjeta = async () => {
    if (!nuevaTarjeta.nombre.trim()) return
    try { await addTarjeta(nuevaTarjeta); setNuevaTarjeta({ nombre: '', banco: '' }); toast.success('Tarjeta agregada') }
    catch { toast.error('Error al agregar tarjeta') }
  }

  const handleSaveTarjeta = async () => {
    if (!editingTarjeta || !editingTarjeta.nombre.trim()) return
    try { await updateTarjeta(editingTarjeta.id, editingTarjeta); setEditingTarjeta(null); toast.success('Tarjeta actualizada') }
    catch { toast.error('Error al actualizar tarjeta') }
  }

  // Settings (estimado próximo mes)
  const [settings, setSettings] = useState({
    estim_meses_atras: 2,
    estim_missing_behavior: 'zero' as 'zero' | 'average_found',
    estim_incluir_cuotas_vigentes: true,
    estim_excluir_ultima_cuota: true,
  })
  const [savingSettings, setSavingSettings] = useState(false)
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings).catch(() => {})
  }, [])
  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setSettings(updated)
      toast.success('Configuración guardada')
    } catch {
      toast.error('Error al guardar configuración')
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>Configuración</Typography>

      <Grid container spacing={3}>
        {/* Casas */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={700} variant="h6">Casas</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  size="small" fullWidth
                  label="Nombre de la casa"
                  value={nuevaCasa}
                  onChange={e => setNuevaCasa(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCasa()}
                />
                <IconButton onClick={handleAddCasa} color="primary"><AddIcon /></IconButton>
              </Box>
              <Divider sx={{ mb: 1 }} />
              <List dense disablePadding sx={{ maxHeight: 320, overflowY: 'auto' }}>
                {casas.map(c => (
                  <ListItem key={c.id} disablePadding sx={{ py: 0.5 }}
                    secondaryAction={
                      editingCasa?.id === c.id ? (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton size="small" color="primary" onClick={handleSaveCasa}><CheckIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => setEditingCasa(null)}><CloseIcon fontSize="small" /></IconButton>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton size="small" onClick={() => setEditingCasa({ id: c.id, nombre: c.nombre })}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => { removeCasa(c.id); toast.success('Casa eliminada') }}><DeleteIcon fontSize="small" /></IconButton>
                        </Box>
                      )
                    }
                  >
                    {editingCasa?.id === c.id ? (
                      <TextField
                        size="small" fullWidth autoFocus
                        value={editingCasa.nombre}
                        onChange={e => setEditingCasa(p => p ? { ...p, nombre: e.target.value } : p)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveCasa(); if (e.key === 'Escape') setEditingCasa(null) }}
                        sx={{ mr: 9 }}
                      />
                    ) : (
                      <ListItemText primary={c.nombre} sx={{ pr: 9 }} />
                    )}
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Monedas */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={700} variant="h6">Monedas</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                <TextField size="small" label="Código (ej: USD)" value={nuevaMoneda.codigo} onChange={e => setNuevaMoneda(p => ({ ...p, codigo: e.target.value.toUpperCase() }))} />
                <TextField size="small" label="Nombre" value={nuevaMoneda.nombre} onChange={e => setNuevaMoneda(p => ({ ...p, nombre: e.target.value }))} />
                <TextField size="small" label="Símbolo (ej: US$)" value={nuevaMoneda.simbolo} onChange={e => setNuevaMoneda(p => ({ ...p, simbolo: e.target.value }))} />
                <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddMoneda} size="small">Agregar</Button>
              </Box>
              <Divider sx={{ mb: 1 }} />
              <List dense disablePadding sx={{ maxHeight: 320, overflowY: 'auto' }}>
                {monedas.map(m => (
                  <ListItem key={m.id} disablePadding sx={{ py: 0.5, flexDirection: 'column', alignItems: 'stretch' }}>
                    {editingMoneda?.id === m.id ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, py: 1 }}>
                        <TextField size="small" label="Código" autoFocus value={editingMoneda.codigo} onChange={e => setEditingMoneda(p => p ? { ...p, codigo: e.target.value.toUpperCase() } : p)} onKeyDown={e => { if (e.key === 'Enter') handleSaveMoneda(); if (e.key === 'Escape') setEditingMoneda(null) }} />
                        <TextField size="small" label="Nombre" value={editingMoneda.nombre} onChange={e => setEditingMoneda(p => p ? { ...p, nombre: e.target.value } : p)} onKeyDown={e => { if (e.key === 'Enter') handleSaveMoneda(); if (e.key === 'Escape') setEditingMoneda(null) }} />
                        <TextField size="small" label="Símbolo" value={editingMoneda.simbolo} onChange={e => setEditingMoneda(p => p ? { ...p, simbolo: e.target.value } : p)} onKeyDown={e => { if (e.key === 'Enter') handleSaveMoneda(); if (e.key === 'Escape') setEditingMoneda(null) }} />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button size="small" variant="contained" startIcon={<CheckIcon />} onClick={handleSaveMoneda}>Guardar</Button>
                          <Button size="small" startIcon={<CloseIcon />} onClick={() => setEditingMoneda(null)}>Cancelar</Button>
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <ListItemText primary={`${m.simbolo} ${m.codigo}`} secondary={m.nombre} />
                        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                          <IconButton size="small" onClick={() => setEditingMoneda({ ...m })}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => { removeMoneda(m.id); toast.success('Moneda eliminada') }}><DeleteIcon fontSize="small" /></IconButton>
                        </Box>
                      </Box>
                    )}
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Categorias */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={700} variant="h6">Categorías</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  size="small" fullWidth
                  label="Ej: Amazon, Supermercado, Combustible"
                  value={nuevoCategoria}
                  onChange={e => setNuevoCategoria(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCategoria()}
                />
                <IconButton onClick={handleAddCategoria} color="primary"><AddIcon /></IconButton>
              </Box>
              <Divider sx={{ mb: 1 }} />
              <List dense disablePadding sx={{ maxHeight: 320, overflowY: 'auto' }}>
                {categorias.map(l => (
                  <ListItem key={l.id} disablePadding sx={{ py: 0.5 }}
                    secondaryAction={
                      editingCategoria?.id === l.id ? (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton size="small" color="primary" onClick={handleSaveCategoria}><CheckIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => setEditingCategoria(null)}><CloseIcon fontSize="small" /></IconButton>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton size="small" onClick={() => setEditingCategoria({ id: l.id, nombre: l.nombre })}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => { removeCategoria(l.id); toast.success('Categoría eliminada') }}><DeleteIcon fontSize="small" /></IconButton>
                        </Box>
                      )
                    }
                  >
                    {editingCategoria?.id === l.id ? (
                      <TextField
                        size="small" fullWidth autoFocus
                        value={editingCategoria.nombre}
                        onChange={e => setEditingCategoria(p => p ? { ...p, nombre: e.target.value } : p)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveCategoria(); if (e.key === 'Escape') setEditingCategoria(null) }}
                        sx={{ mr: 9 }}
                      />
                    ) : (
                      <ListItemText primary={l.nombre} sx={{ pr: 9 }} />
                    )}
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Tarjetas */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={700} variant="h6">Tarjetas de Crédito</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                <TextField size="small" label="Nombre de la tarjeta" value={nuevaTarjeta.nombre} onChange={e => setNuevaTarjeta(p => ({ ...p, nombre: e.target.value }))} />
                <TextField size="small" label="Banco (opcional)" value={nuevaTarjeta.banco} onChange={e => setNuevaTarjeta(p => ({ ...p, banco: e.target.value }))} />
                <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddTarjeta} size="small">Agregar</Button>
              </Box>
              <Divider sx={{ mb: 1 }} />
              <List dense disablePadding sx={{ maxHeight: 320, overflowY: 'auto' }}>
                {tarjetas.map(t => (
                  <ListItem key={t.id} disablePadding sx={{ py: 0.5, flexDirection: 'column', alignItems: 'stretch' }}>
                    {editingTarjeta?.id === t.id ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, py: 1 }}>
                        <TextField size="small" label="Nombre" autoFocus value={editingTarjeta.nombre} onChange={e => setEditingTarjeta(p => p ? { ...p, nombre: e.target.value } : p)} onKeyDown={e => { if (e.key === 'Enter') handleSaveTarjeta(); if (e.key === 'Escape') setEditingTarjeta(null) }} />
                        <TextField size="small" label="Banco (opcional)" value={editingTarjeta.banco ?? ''} onChange={e => setEditingTarjeta(p => p ? { ...p, banco: e.target.value } : p)} onKeyDown={e => { if (e.key === 'Enter') handleSaveTarjeta(); if (e.key === 'Escape') setEditingTarjeta(null) }} />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button size="small" variant="contained" startIcon={<CheckIcon />} onClick={handleSaveTarjeta}>Guardar</Button>
                          <Button size="small" startIcon={<CloseIcon />} onClick={() => setEditingTarjeta(null)}>Cancelar</Button>
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <ListItemText primary={t.nombre} secondary={t.banco ?? undefined} />
                        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                          <IconButton size="small" onClick={() => setEditingTarjeta({ ...t })}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => { removeTarjeta(t.id); toast.success('Tarjeta eliminada') }}><DeleteIcon fontSize="small" /></IconButton>
                        </Box>
                      </Box>
                    )}
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Estimación próximo mes */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              titleTypographyProps={{ fontWeight: 700, variant: 'h6' }}
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Estimación próximo mes
                  <Tooltip
                    arrow
                    componentsProps={{ tooltip: { sx: { maxWidth: 480, p: 1.5, fontSize: 12, lineHeight: 1.5 } } }}
                    title={
                      <Box>
                        <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>¿Cómo se calcula?</Typography>
                        <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
                          Por cada gasto del mes actual se construyen <strong>unidades</strong>:
                        </Typography>
                        <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1 }}>
                          <li>Si tiene sub-items con <em>"Incluir en total"</em>, se agrupan por descripción (sumando) y cada grupo es una unidad.</li>
                          <li>Si no, el gasto en sí es la unidad.</li>
                        </Box>
                        <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>Para cada unidad:</Typography>
                        <Box component="ol" sx={{ pl: 2.5, mt: 0, mb: 1 }}>
                          <li>Si <em>"Excluir última cuota"</em> está activo y la unidad está en su última cuota → se omite.</li>
                          <li>Si <em>"Sumar cuotas vigentes"</em> está activo y la unidad está en cuotas → se suma el monto sin promediar.</li>
                          <li>
                            Si no, se busca el mismo gasto/sub-item por descripción (normalizada con <code>trim().toLowerCase()</code>)
                            en los últimos <strong>N</strong> meses (configurado abajo).
                          </li>
                          <li>
                            Para meses sin match: según el modo, se toma 0 o se omite ese mes del promedio.
                          </li>
                          <li>
                            La unidad aporta <strong>el promedio</strong> del valor actual + los valores encontrados en meses anteriores.
                          </li>
                        </Box>
                        <Typography variant="caption" sx={{ display: 'block' }}>
                          El total estimado es la suma de los aportes de todas las unidades.
                        </Typography>
                      </Box>
                    }
                  >
                    <IconButton size="small" sx={{ color: 'text.secondary' }}>
                      <HelpOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              }
            />
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Estos parámetros controlan cómo se calcula el monto estimado en la tarjeta "Estimado próximo mes" del resumen.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  type="number"
                  label="Meses hacia atrás para el promedio"
                  value={settings.estim_meses_atras}
                  onChange={e => setSettings(p => ({ ...p, estim_meses_atras: Math.max(0, Math.min(12, Number(e.target.value) || 0)) }))}
                  inputProps={{ min: 0, max: 12, step: 1 }}
                  sx={{ minWidth: 240 }}
                  helperText="Mes actual + N meses previos"
                />
                <FormControl size="small" sx={{ minWidth: 280 }}>
                  <InputLabel>Comportamiento sin match</InputLabel>
                  <Select
                    label="Comportamiento sin match"
                    value={settings.estim_missing_behavior}
                    onChange={e => setSettings(p => ({ ...p, estim_missing_behavior: e.target.value as 'zero' | 'average_found' }))}
                  >
                    <MenuItem value="zero">Tomar 0 cuando no hay match (default)</MenuItem>
                    <MenuItem value="average_found">Promediar solo con los meses con match</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
                <AppToggle
                  checked={settings.estim_incluir_cuotas_vigentes}
                  onChange={e => setSettings(p => ({ ...p, estim_incluir_cuotas_vigentes: e.target.checked }))}
                  label={<Typography variant="body2">Sumar directamente cuotas vigentes (sin promediar)</Typography>}
                />
                <AppToggle
                  checked={settings.estim_excluir_ultima_cuota}
                  onChange={e => setSettings(p => ({ ...p, estim_excluir_ultima_cuota: e.target.checked }))}
                  label={<Typography variant="body2">Excluir gastos cuya cuota actual sea la última</Typography>}
                />
              </Box>
              <Button variant="contained" onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? 'Guardando…' : 'Guardar'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
