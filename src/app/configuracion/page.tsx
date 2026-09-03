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
import Chip from '@mui/material/Chip'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import TarjetaCierres from '@/components/configuracion/TarjetaCierres'
import ConceptosManager from '@/components/configuracion/ConceptosManager'
import NotificacionesCard from '@/components/configuracion/NotificacionesCard'
import { MARCAS, marcaColor } from '@/components/shared/TarjetaLogo'
import BancoLogo from '@/components/shared/BancoLogo'
import IconoBancoUpload from '@/components/shared/IconoBancoUpload'
import { BANCOS } from '@/lib/bancos'
import { tarjetaActivaEn } from '@/lib/tarjetas-baja'
import BrandLogo from '@/components/shared/BrandLogo'
import AppSelect from '@/components/shared/AppSelect'
import ClasificadorManager from '@/components/configuracion/ClasificadorManager'
import EtiquetasPorCategoria from '@/components/configuracion/EtiquetasPorCategoria'
import type { Casa, Categoria, Etiqueta, Moneda, Settings, Tarjeta, TarjetaBanco, TarjetaMarca } from '@/lib/types'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/** Período que se propone al marcar la baja: el mes actual, que es el caso normal. */
const bajaDefault = () => {
  const d = new Date()
  return { baja_mes: d.getMonth() + 1, baja_anio: d.getFullYear() }
}

/** `MM/AAAA` para mostrar un período de baja. */
const periodoLabel = (mes: number, anio: number) => `${String(mes).padStart(2, '0')}/${anio}`

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
    const res = await fetch(`${endpoint}/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? 'Error al eliminar')
    }
    await load()
  }

  return { items, add, update, remove, reload: load }
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
  const { items: tarjetas, add: addTarjeta, update: updateTarjeta, remove: removeTarjeta, reload: reloadTarjetas } = useSimpleCrud<Tarjeta>('/api/tarjetas')
  const [nuevaTarjeta, setNuevaTarjeta] = useState<{ nombre: string; banco: string; marca: TarjetaMarca | ''; banco_logo: TarjetaBanco | ''; banco_icono: string | null }>({ nombre: '', banco: '', marca: '', banco_logo: '', banco_icono: null })
  const [editingTarjeta, setEditingTarjeta] = useState<Tarjeta | null>(null)

  // Categorías y etiquetas: el ABM completo (alta, renombrar, fusionar, borrar) vive en
  // `ClasificadorManager`, que se usa para los dos ejes. Acá sólo queda la lista y su reload.
  const { items: categorias, reload: loadCategorias } = useSimpleCrud<Categoria>('/api/categorias')
  const { items: etiquetas, reload: loadEtiquetas } = useSimpleCrud<Etiqueta>('/api/etiquetas')

  const handleRemoveCasa = async (id: number) => {
    try { await removeCasa(id); toast.success('Casa eliminada') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Error al eliminar casa') }
  }

  const handleRemoveMoneda = async (id: number) => {
    try { await removeMoneda(id); toast.success('Moneda eliminada') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Error al eliminar moneda') }
  }

  const handleRemoveTarjeta = async (id: number) => {
    try { await removeTarjeta(id); toast.success('Tarjeta eliminada') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Error al eliminar tarjeta') }
  }

  // Confirmación de borrado genérica para todas las secciones de configuración.
  const [confirmDelete, setConfirmDelete] = useState<{ nombre: string; run: () => void | Promise<void> } | null>(null)
  const askDelete = (nombre: string, run: () => void | Promise<void>) => setConfirmDelete({ nombre, run })

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

  const handleAddTarjeta = async () => {
    if (!nuevaTarjeta.nombre.trim()) return
    try {
      await addTarjeta({ ...nuevaTarjeta, marca: nuevaTarjeta.marca || null, banco_logo: nuevaTarjeta.banco_logo || null })
      setNuevaTarjeta({ nombre: '', banco: '', marca: '', banco_logo: '', banco_icono: null })
      toast.success('Tarjeta agregada')
    } catch { toast.error('Error al agregar tarjeta') }
  }

  const handleSaveTarjeta = async () => {
    if (!editingTarjeta || !editingTarjeta.nombre.trim()) return
    try { await updateTarjeta(editingTarjeta.id, editingTarjeta); setEditingTarjeta(null); toast.success('Tarjeta actualizada') }
    catch { toast.error('Error al actualizar tarjeta') }
  }

  // Settings (estimado próximo mes + defaults del alta de gastos)
  const [settings, setSettings] = useState<Settings>({
    estim_meses_atras: 2,
    estim_missing_behavior: 'zero',
    estim_incluir_cuotas_vigentes: true,
    estim_excluir_ultima_cuota: true,
    casa_default_id: null,
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
                          <IconButton size="small" onClick={() => askDelete(c.nombre, () => handleRemoveCasa(c.id))}><DeleteIcon fontSize="small" /></IconButton>
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
                          <IconButton size="small" onClick={() => askDelete(`${m.simbolo} ${m.codigo}`, () => handleRemoveMoneda(m.id))}><DeleteIcon fontSize="small" /></IconButton>
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
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Partición del gasto: una sola por gasto/sub-ítem. Es el eje del reporte por categoría.
              </Typography>
              <ClasificadorManager
                endpoint="/api/categorias"
                items={categorias}
                onReload={loadCategorias}
                singular="categoría"
                articulo="la"
                placeholder="Ej: Amazon, Supermercado, Combustible"
                onAskDelete={askDelete}
              />
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Etiquetas */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={700} variant="h6">Etiquetas</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Cortes transversales (un gasto puede tener varias). Ej: Viaje, Deducible, Compartido, Extraordinario.
              </Typography>
              <ClasificadorManager
                endpoint="/api/etiquetas"
                items={etiquetas}
                onReload={loadEtiquetas}
                singular="etiqueta"
                articulo="la"
                placeholder="Ej: Viaje, Deducible, Compartido"
                onAskDelete={askDelete}
              />
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Etiquetas por categoría — qué ofrece el form, derivado del histórico + excepciones */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={700} variant="h6">Etiquetas por categoría</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <EtiquetasPorCategoria categorias={categorias} etiquetas={etiquetas} />
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Conceptos */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={700} variant="h6">Conceptos</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <ConceptosManager />
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
                <TextField
                  select size="small" label="Marca (opcional)"
                  SelectProps={{ native: true }}
                  value={nuevaTarjeta.marca}
                  onChange={e => setNuevaTarjeta(p => ({ ...p, marca: e.target.value as TarjetaMarca | '' }))}
                >
                  <option value="">—</option>
                  {MARCAS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </TextField>
                <TextField
                  select size="small" label="Banco del icono (opcional)"
                  SelectProps={{ native: true }}
                  helperText="Si lo dejás vacío se infiere del texto de Banco"
                  value={nuevaTarjeta.banco_logo}
                  onChange={e => setNuevaTarjeta(p => ({ ...p, banco_logo: e.target.value as TarjetaBanco | '' }))}
                >
                  <option value="">—</option>
                  {BANCOS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </TextField>
                <IconoBancoUpload
                  value={nuevaTarjeta.banco_icono}
                  onChange={dataUri => setNuevaTarjeta(p => ({ ...p, banco_icono: dataUri }))}
                  bancoLogo={nuevaTarjeta.banco_logo}
                  bancoTexto={nuevaTarjeta.banco}
                />
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
                        <TextField
                          select size="small" label="Marca (opcional)"
                          SelectProps={{ native: true }}
                          value={editingTarjeta.marca ?? ''}
                          onChange={e => setEditingTarjeta(p => p ? { ...p, marca: (e.target.value || null) as TarjetaMarca | null } : p)}
                        >
                          <option value="">—</option>
                          {MARCAS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </TextField>
                        <TextField
                          select size="small" label="Banco del icono (opcional)"
                          SelectProps={{ native: true }}
                          helperText="Si lo dejás vacío se infiere del texto de Banco"
                          value={editingTarjeta.banco_logo ?? ''}
                          onChange={e => setEditingTarjeta(p => p ? { ...p, banco_logo: (e.target.value || null) as TarjetaBanco | null } : p)}
                        >
                          <option value="">—</option>
                          {BANCOS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                        </TextField>
                        <IconoBancoUpload
                          value={editingTarjeta.banco_icono}
                          onChange={dataUri => setEditingTarjeta(p => p ? { ...p, banco_icono: dataUri } : p)}
                          bancoLogo={editingTarjeta.banco_logo}
                          bancoTexto={editingTarjeta.banco}
                        />
                        <Divider />
                        {/* Baja de la tarjeta: la saca de /gastos desde el período elegido sin
                            borrarla, así los gastos que la usaron siguen ahí. */}
                        <AppToggle
                          label="Dada de baja (ya no la tengo)"
                          checked={editingTarjeta.baja_mes != null && editingTarjeta.baja_anio != null}
                          onChange={e => setEditingTarjeta(p => p
                            ? { ...p, ...(e.target.checked ? bajaDefault() : { baja_mes: null, baja_anio: null }) }
                            : p)}
                        />
                        {editingTarjeta.baja_mes != null && editingTarjeta.baja_anio != null && (
                          <>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <TextField
                                select size="small" label="Baja desde el mes" sx={{ flex: 1 }}
                                SelectProps={{ native: true }}
                                value={editingTarjeta.baja_mes}
                                onChange={e => setEditingTarjeta(p => p ? { ...p, baja_mes: Number(e.target.value) } : p)}
                              >
                                {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                              </TextField>
                              <TextField
                                size="small" type="number" label="Año" sx={{ flex: 1 }}
                                value={editingTarjeta.baja_anio}
                                onChange={e => setEditingTarjeta(p => p ? { ...p, baja_anio: Number(e.target.value) || p.baja_anio } : p)}
                              />
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              Desde {MESES[editingTarjeta.baja_mes - 1]} {editingTarjeta.baja_anio} inclusive deja de
                              aparecer en Gastos. Los meses anteriores y los reportes no cambian.
                            </Typography>
                          </>
                        )}
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button size="small" variant="contained" startIcon={<CheckIcon />} onClick={handleSaveTarjeta}>Guardar</Button>
                          <Button size="small" startIcon={<CloseIcon />} onClick={() => setEditingTarjeta(null)}>Cancelar</Button>
                        </Box>
                      </Box>
                    ) : (() => {
                      const accent = marcaColor(t.marca) ?? '#6366f1'
                      const now = new Date()
                      const currentMes = now.getMonth() + 1
                      const currentAnio = now.getFullYear()
                      const currentCierre = t.cierres?.find(c => c.mes === currentMes && c.anio === currentAnio)
                      const activa = tarjetaActivaEn(t, currentMes, currentAnio)
                      // A una tarjeta de baja no le falta el cierre del mes: no lo va a tener nunca.
                      // Dejar el warning prendido sería una alerta permanente imposible de resolver.
                      const incompleto = activa && (!currentCierre || !currentCierre.fecha_cierre || !currentCierre.fecha_vencimiento || !currentCierre.fecha_proximo_cierre)
                      const alertaMsg = !currentCierre
                        ? `No hay cierre cargado para ${String(currentMes).padStart(2, '0')}/${currentAnio}`
                        : 'Faltan fechas en el cierre del mes actual'
                      return (
                        <Accordion
                          disableGutters
                          TransitionProps={{ unmountOnExit: true }}
                          sx={{
                            width: '100%',
                            boxShadow: 'none',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: activa ? `${accent}55` : 'divider',
                            bgcolor: activa ? `${accent}10` : 'action.hover',
                            '&:before': { display: 'none' },
                            '&.Mui-expanded': { margin: 0 },
                          }}
                        >
                          <AccordionSummary
                            sx={{
                              px: 1.5,
                              minHeight: 0,
                              '& .MuiAccordionSummary-content': { my: 1, alignItems: 'center', justifyContent: 'space-between', gap: 1 },
                              '& .MuiAccordionSummary-content.Mui-expanded': { my: 1 },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, ...(activa ? {} : { filter: 'grayscale(1)', opacity: 0.6 }) }}>
                                <BrandLogo marca={t.marca} width={44} height={32} />
                                <BancoLogo banco={t.banco_logo} icono={t.banco_icono} bancoTexto={t.banco} size={24} />
                                <ListItemText primary={t.nombre} secondary={t.banco ?? undefined} />
                              </Box>
                              {t.baja_mes != null && t.baja_anio != null && (
                                <Tooltip arrow title={`No aparece en Gastos desde ${periodoLabel(t.baja_mes, t.baja_anio)}; el histórico anterior se mantiene`}>
                                  <Chip
                                    size="small"
                                    variant="outlined"
                                    label={`Baja ${periodoLabel(t.baja_mes, t.baja_anio)}`}
                                    sx={{ flexShrink: 0, height: 20, fontSize: '0.7rem' }}
                                  />
                                </Tooltip>
                              )}
                              {incompleto && (
                                <Tooltip arrow title={alertaMsg}>
                                  <WarningAmberIcon sx={{ color: 'warning.main', fontSize: 20, flexShrink: 0 }} />
                                </Tooltip>
                              )}
                            </Box>
                            <Box
                              sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}
                              onClick={e => e.stopPropagation()}
                            >
                              <IconButton size="small" onClick={() => setEditingTarjeta({ ...t })}><EditIcon fontSize="small" /></IconButton>
                              <IconButton size="small" onClick={() => askDelete(t.nombre, () => handleRemoveTarjeta(t.id))}><DeleteIcon fontSize="small" /></IconButton>
                            </Box>
                          </AccordionSummary>
                          <AccordionDetails sx={{ px: 1.5, pt: 0 }}>
                            <TarjetaCierres tarjetaId={t.id} onCierresChange={reloadTarjetas} />
                          </AccordionDetails>
                        </Accordion>
                      )
                    })()}
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Notificaciones push de vencimientos */}
        <Grid item xs={12}>
          <NotificacionesCard />
        </Grid>

        {/* Valores por defecto del alta de gastos */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              titleTypographyProps={{ fontWeight: 700, variant: 'h6' }}
              title="Valores por defecto (nuevo gasto)"
            />
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                El resto de los campos del alta se prefillean solos con los datos del último gasto
                del concepto que elijas (categoría, etiquetas, medio de pago, monto).
              </Typography>
              <Box sx={{ maxWidth: 360, mb: 2 }}>
                <AppSelect
                  label="Casa por defecto"
                  options={casas.map(c => ({ value: c.id, label: c.nombre }))}
                  value={settings.casa_default_id}
                  onChange={v => setSettings(p => ({ ...p, casa_default_id: v == null ? null : Number(v) }))}
                  fullWidth
                  emptyLabel="Sin default (elegir cada vez)"
                  helperText="Se preselecciona al abrir el alta de un gasto"
                />
              </Box>
              <Button variant="contained" onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? 'Guardando…' : 'Guardar'}
              </Button>
            </CardContent>
          </Card>
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
                          <li>Si tiene sub-items con <em>"Incluir en total"</em>, se agrupan por concepto (sumando) y cada grupo es una unidad.</li>
                          <li>Si no, el gasto en sí es la unidad.</li>
                        </Box>
                        <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>Para cada unidad:</Typography>
                        <Box component="ol" sx={{ pl: 2.5, mt: 0, mb: 1 }}>
                          <li>Si <em>"Excluir última cuota"</em> está activo y la unidad está en su última cuota → se omite.</li>
                          <li>Si <em>"Sumar cuotas vigentes"</em> está activo y la unidad está en cuotas → se suma el monto sin promediar.</li>
                          <li>
                            Si no, se busca el mismo gasto/sub-item por <strong>concepto</strong>
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

      <ConfirmDialog
        open={!!confirmDelete}
        title="Confirmar eliminación"
        message={`¿Seguro que querés eliminar "${confirmDelete?.nombre ?? ''}"? Esta acción no se puede deshacer.`}
        onConfirm={async () => { await confirmDelete?.run(); setConfirmDelete(null) }}
        onCancel={() => setConfirmDelete(null)}
      />
    </Box>
  )
}
