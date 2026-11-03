'use client'

import { useEffect, useMemo, useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Collapse from '@mui/material/Collapse'
import Grid from '@mui/material/Grid'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ClearIcon from '@mui/icons-material/Clear'
import SearchIcon from '@mui/icons-material/Search'
import SettingsIcon from '@mui/icons-material/Settings'
import toast from 'react-hot-toast'
import TextField from '@/components/shared/AppTextField'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { useGastosStore } from '@/store/gastosStore'
import CatalogoAdminDialog from '@/components/lista-compras/CatalogoAdminDialog'
import CatalogoSelect from '@/components/lista-compras/CatalogoSelect'
import CompraDialog from '@/components/lista-compras/CompraDialog'
import FilaLista from '@/components/lista-compras/FilaLista'
import { fmtARS, parseNum } from '@/components/lista-compras/formato'
import { useListaCompras, type AltaItem } from '@/components/lista-compras/useListaCompras'
import { coincideBusqueda, parseColapsados, totalesLista } from '@/lib/lista-compras-compute'
import type { ArticuloCatalogo, ListaCompraCompra, ListaCompraItem } from '@/lib/types'

const CLAVE_COLAPSADOS = 'lista-compras:rubros-colapsados'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function ListaComprasPage() {
  const { filtros, setFiltros } = useGastosStore()
  const { mes, anio } = filtros
  // Debajo de `md` la pantalla pasa al diseño compacto (filas apiladas, botones grandes).
  const compacta = useMediaQuery(useTheme().breakpoints.down('md'))
  const {
    items, totales, catalogo, loading, unidades, rubros, crearUnidad, crearRubro,
    recargarOpciones, renombrarOpcion, borrarOpcion, fijarSubunidad,
    agregar, cambiar, eliminar, copiarDelMesAnterior, guardarCompra, borrarCompra,
  } = useListaCompras(mes, anio)

  const [nombre, setNombre] = useState('')
  const [unidadId, setUnidadId] = useState<number | null>(null)
  const [rubroId, setRubroId] = useState<number | null>(null)
  const [cantidad, setCantidad] = useState('1')
  const [adminAbierto, setAdminAbierto] = useState(false)
  const [formAbierto, setFormAbierto] = useState(false)
  // Rubros plegados (por nombre). Se recuerdan en este navegador: es una comodidad por usuario.
  const [colapsados, setColapsados] = useState<Set<string>>(new Set())
  const [colapsadosListos, setColapsadosListos] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [aQuitar, setAQuitar] = useState<ListaCompraItem | null>(null)
  // Compra que se está registrando (compra = null) o editando, y compra a confirmar para borrar.
  const [compraDialog, setCompraDialog] = useState<{ item: ListaCompraItem; compra: ListaCompraCompra | null } | null>(null)
  const [compraABorrar, setCompraABorrar] = useState<{ item: ListaCompraItem; compra: ListaCompraCompra } | null>(null)
  const [sugerido, setSugerido] = useState<ArticuloCatalogo | null>(null)

  const prevMes = () => (mes === 1 ? setFiltros({ mes: 12, anio: anio - 1 }) : setFiltros({ mes: mes - 1 }))
  const nextMes = () => (mes === 12 ? setFiltros({ mes: 1, anio: anio + 1 }) : setFiltros({ mes: mes + 1 }))

  // Los artículos que ya están en la lista no se ofrecen de nuevo.
  const enLista = useMemo(() => new Set(items.map((i) => i.articulo_id)), [items])
  const opciones = useMemo(() => catalogo.filter((a) => !enLista.has(a.id)), [catalogo, enLista])

  // Se lee al montar (no en el estado inicial: el server no tiene localStorage y desajustaría el HTML).
  useEffect(() => {
    try { setColapsados(new Set(parseColapsados(localStorage.getItem(CLAVE_COLAPSADOS)))) } catch { /* sin storage: arranca todo abierto */ }
    setColapsadosListos(true)
  }, [])
  useEffect(() => {
    if (!colapsadosListos) return // no pisar lo guardado con el estado vacío del primer render
    try { localStorage.setItem(CLAVE_COLAPSADOS, JSON.stringify(Array.from(colapsados))) } catch { /* ignorar */ }
  }, [colapsados, colapsadosListos])

  // Si la unidad/rubro elegidos en el formulario se borraron, se limpian.
  useEffect(() => {
    if (unidadId != null && unidades.length && !unidades.some((u) => u.id === unidadId)) setUnidadId(null)
    if (rubroId != null && !rubros.some((r) => r.id === rubroId)) setRubroId(null)
  }, [unidades, rubros, unidadId, rubroId])

  // Unidad por defecto: "un" (viene sembrada); si no está, la primera disponible.
  useEffect(() => {
    if (unidadId == null && unidades.length) {
      setUnidadId((unidades.find((u) => u.nombre.toLowerCase() === 'un') ?? unidades[0]).id)
    }
  }, [unidades, unidadId])

  const grupos = useMemo(() => {
    const m = new Map<string, ListaCompraItem[]>()
    for (const i of items) {
      const k = i.rubro ?? 'Sin rubro'
      m.set(k, [...(m.get(k) ?? []), i])
    }
    // "Sin rubro" siempre al final.
    return Array.from(m.entries()).sort(([a], [b]) => (a === 'Sin rubro' ? 1 : b === 'Sin rubro' ? -1 : a.localeCompare(b, 'es')))
  }, [items])

  const alternarRubro = (nombre: string) =>
    setColapsados((prev) => {
      const next = new Set(prev)
      if (!next.delete(nombre)) next.add(nombre)
      return next
    })
  const todosPlegados = grupos.length > 0 && grupos.every(([n]) => colapsados.has(n))

  // Buscador: deja sólo las líneas que coinciden y los rubros que tienen alguna. `filas` conserva
  // todas las del rubro (para el resumen del encabezado) y `visibles` las que se muestran.
  const buscando = busqueda.trim() !== ''
  const gruposVista = useMemo(
    () => grupos.flatMap(([nombre, filas]) => {
      const visibles = buscando ? filas.filter((i) => coincideBusqueda(i, busqueda)) : filas
      return visibles.length ? [{ nombre, filas, visibles }] : []
    }),
    [grupos, busqueda, buscando],
  )
  const coincidencias = gruposVista.reduce((n, g) => n + g.visibles.length, 0)

  const elegir = (a: ArticuloCatalogo | null) => {
    setSugerido(a)
    if (a) {
      setNombre(a.nombre)
      setUnidadId(a.unidad_id)
      setRubroId(a.rubro_id)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = nombre.trim()
    const c = parseNum(cantidad)
    if (!n) return toast.error('Completá el nombre del artículo')
    if (c == null || !Number.isFinite(c) || c <= 0) return toast.error('La cantidad tiene que ser mayor a 0')
    if (unidadId == null) return toast.error('Elegí la unidad')
    const alta: AltaItem = { nombre: n, unidad_id: unidadId, rubro_id: rubroId, cantidad: c }
    if (await agregar(alta)) {
      setNombre(''); setCantidad('1'); setSugerido(null)
      // Si el artículo cae en un rubro plegado, se despliega: si no, parecería que no se agregó.
      const destino = rubros.find((r) => r.id === rubroId)?.nombre ?? 'Sin rubro'
      setColapsados((prev) => {
        if (!prev.has(destino)) return prev
        const next = new Set(prev)
        next.delete(destino)
        return next
      })
    }
  }

  const KPIS = [
    {
      label: 'Estimado del mes',
      value: fmtARS(totales.estimado),
      hint: totales.sin_precio > 0 ? `${totales.sin_precio} sin precio ni referencia (no cuentan)` : 'Precio del mes o, si falta, el de la última compra',
      color: 'text.primary',
    },
    { label: 'Gastado', value: fmtARS(totales.gastado), hint: 'Lo que ya compraste: cantidad llevada × precio', color: 'warning.main' },
    { label: 'Comprados', value: `${totales.comprados} / ${totales.items}`, hint: totales.parciales > 0 ? `${totales.parciales} en curso · ${totales.pendientes} sin completar` : `${totales.pendientes} pendiente(s)`, color: 'success.main' },
  ]

  const abrirAdmin = () => { recargarOpciones(); setAdminAbierto(true) }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: { xs: 2, md: 3 }, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Lista de compras</Typography>
          {!compacta && (
            <Typography variant="body2" color="text.secondary">
              Lo que necesitás comprar en el mes, con el precio de la última vez como referencia
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton size={compacta ? 'medium' : 'small'} onClick={prevMes} aria-label="Mes anterior"><ChevronLeftIcon /></IconButton>
          <Typography variant="body1" fontWeight={600} sx={{ minWidth: { xs: 130, md: 150 }, textAlign: 'center' }}>
            {MESES[mes - 1]} {anio}
          </Typography>
          <IconButton size={compacta ? 'medium' : 'small'} onClick={nextMes} aria-label="Mes siguiente"><ChevronRightIcon /></IconButton>
        </Box>
      </Box>

      {compacta ? (
        // Un solo cuadro de tres renglones en vez de tres tarjetas: ahorra media pantalla.
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
            {KPIS.map((k) => (
              <Box key={k.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', py: 0.5 }}>
                <Typography variant="body2" color="text.secondary">{k.label}</Typography>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: k.color }}>{k.value}</Typography>
              </Box>
            ))}
            {totales.sin_precio > 0 && (
              <Typography variant="caption" color="text.secondary">{totales.sin_precio} sin precio ni referencia (no cuentan en el estimado)</Typography>
            )}
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {KPIS.map((k) => (
            <Grid item xs={12} sm={4} key={k.label}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ pb: '16px !important' }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>{k.label}</Typography>
                  <Typography variant="h6" fontWeight={700} sx={{ color: k.color }}>{k.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{k.hint}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Card sx={{ mb: { xs: 2, md: 3 } }}>
        <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
            {compacta ? (
              // En el celular el formulario arranca plegado: la lista es lo que más se usa.
              <Button
                onClick={() => setFormAbierto((v) => !v)}
                startIcon={<AddIcon />}
                endIcon={formAbierto ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                aria-expanded={formAbierto}
                sx={{ fontWeight: 600, py: 1 }}
              >
                Agregar artículo
              </Button>
            ) : (
              <Typography variant="subtitle1" fontWeight={600}>Agregar artículo</Typography>
            )}
            <Tooltip title="Unidades y rubros">
              <span>
                {compacta ? (
                  <IconButton onClick={abrirAdmin} aria-label="Administrar unidades y rubros"><SettingsIcon /></IconButton>
                ) : (
                  <Button size="small" startIcon={<SettingsIcon />} onClick={abrirAdmin}>
                    Administrar unidades y rubros
                  </Button>
                )}
              </span>
            </Tooltip>
          </Box>

          <Collapse in={!compacta || formAbierto}>
            <Box
              component="form"
              onSubmit={submit}
              sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: { md: 'flex-end' }, flexDirection: { xs: 'column', md: 'row' }, mt: 2 }}
            >
              <Autocomplete
                freeSolo
                options={opciones}
                getOptionLabel={(o) => (typeof o === 'string' ? o : o.nombre)}
                inputValue={nombre}
                value={sugerido}
                onInputChange={(_, v) => setNombre(v)}
                onChange={(_, v) => elegir(typeof v === 'string' ? null : v)}
                renderOption={(props, o) => (
                  <li {...props} key={o.id}>
                    <Box>
                      <Typography variant="body2">{o.nombre}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {o.rubro ?? 'Sin rubro'} · {o.unidad}{o.ultimo_precio != null ? ` · última vez ${fmtARS(o.ultimo_precio)}` : ''}
                      </Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => <TextField {...params} size={compacta ? 'medium' : 'small'} label="Artículo" />}
                sx={{ width: { xs: '100%', md: 'auto' }, flex: { md: '1 1 220px' }, minWidth: { md: 200 } }}
              />
              {/* Cantidad y unidad van juntas en un renglón: son lo que se completa siempre. */}
              <Box sx={{ display: 'flex', gap: 2, width: { xs: '100%', md: 'auto' } }}>
                <TextField
                  size={compacta ? 'medium' : 'small'}
                  label="Cantidad"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  inputProps={{ inputMode: 'decimal' }}
                  sx={{ flex: { xs: 1, md: 'none' }, width: { md: 110 } }}
                />
                <CatalogoSelect
                  label="Unidad"
                  options={unidades}
                  value={unidadId}
                  onChange={setUnidadId}
                  onCrear={crearUnidad}
                  width={compacta ? undefined : 130}
                  fullWidth={compacta}
                  medium={compacta}
                />
              </Box>
              <CatalogoSelect
                label="Rubro (opcional)"
                options={rubros}
                value={rubroId}
                onChange={setRubroId}
                onCrear={crearRubro}
                clearable
                width={compacta ? '100%' : 190}
                medium={compacta}
              />
              <Typography variant="caption" color="text.secondary" sx={{ width: { xs: '100%', md: 'auto' }, maxWidth: { md: 240 } }}>
                El precio se carga al registrar cada compra: el del artículo es el promedio de lo que fuiste comprando.
              </Typography>
              <Button type="submit" variant="contained" size={compacta ? 'large' : 'medium'} startIcon={<AddIcon />} sx={{ width: { xs: '100%', md: 'auto' } }}>
                Agregar
              </Button>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle1" fontWeight={600}>Lista de {MESES[mes - 1]}</Typography>
            {grupos.length > 1 && !buscando && (
              <Button
                size={compacta ? 'medium' : 'small'}
                startIcon={todosPlegados ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                onClick={() => setColapsados(todosPlegados ? new Set() : new Set(grupos.map(([n]) => n)))}
              >
                {todosPlegados ? 'Expandir todos' : 'Colapsar todos'}
              </Button>
            )}
            <Tooltip title="Trae los artículos y cantidades del último mes con lista. Los precios no se copian: quedan como referencia.">
              <Button size={compacta ? 'medium' : 'small'} startIcon={<ContentCopyIcon />} onClick={copiarDelMesAnterior}>
                Copiar del mes anterior
              </Button>
            </Tooltip>
          </Box>

          <TextField
            type="search"
            size={compacta ? 'medium' : 'small'}
            fullWidth
            placeholder="Buscar artículo o rubro"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setBusqueda('') }}
            inputProps={{ 'aria-label': 'Buscar artículo o rubro', autoComplete: 'off' }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              endAdornment: buscando ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda"><ClearIcon fontSize="small" /></IconButton>
                </InputAdornment>
              ) : undefined,
            }}
            sx={{ mb: 1.5 }}
          />
          {buscando && items.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {coincidencias === 0
                ? `Ningún artículo coincide con "${busqueda.trim()}".`
                : `${coincidencias} de ${items.length} artículo${items.length === 1 ? '' : 's'}`}
            </Typography>
          )}

          {!loading && items.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              No hay artículos en la lista de este mes. Agregalos arriba o copiá los del mes anterior.
            </Typography>
          )}

          {gruposVista.map(({ nombre: rubroNombre, filas, visibles }) => {
            // Buscando, los rubros con coincidencias se muestran desplegados aunque estén plegados.
            const plegado = !buscando && colapsados.has(rubroNombre)
            const resumen = totalesLista(filas)
            return (
            <Box key={rubroNombre} sx={{ mb: 1 }}>
              {/* Encabezado tocable: pliega el rubro y, plegado, sigue mostrando cuánto va. */}
              <ButtonBase
                onClick={() => alternarRubro(rubroNombre)}
                disabled={buscando}
                aria-expanded={!plegado}
                sx={{ width: '100%', justifyContent: 'space-between', gap: 1, py: compacta ? 1.25 : 0.75, px: 0.5, borderRadius: 1, textAlign: 'left', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                  {plegado ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
                  <Typography variant="overline" color="text.secondary" fontWeight={700} noWrap>{rubroNombre}</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {buscando ? `${visibles.length} de ${filas.length} · ` : ''}{resumen.comprados}/{resumen.items} comprados{plegado && resumen.estimado > 0 ? ` · ${fmtARS(resumen.estimado)}` : ''}
                </Typography>
              </ButtonBase>
              <Collapse in={!plegado} unmountOnExit>
              {visibles.map((i) => (
                <FilaLista
                  key={i.id}
                  item={i}
                  unidades={unidades}
                  rubros={rubros}
                  onCrearUnidad={crearUnidad}
                  onCrearRubro={crearRubro}
                  onCambiar={cambiar}
                  onEliminar={setAQuitar}
                  onRegistrarCompra={(it) => setCompraDialog({ item: it, compra: null })}
                  onEditarCompra={(it, compra) => setCompraDialog({ item: it, compra })}
                  onBorrarCompra={(it, compra) => setCompraABorrar({ item: it, compra })}
                  compacta={compacta}
                />
              ))}
              </Collapse>
            </Box>
            )
          })}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!aQuitar}
        title="Quitar de la lista"
        message={aQuitar ? `¿Quitar "${aQuitar.nombre}" de la lista de ${MESES[mes - 1]}? El artículo y su historial de precios se conservan.` : ''}
        confirmLabel="Quitar"
        onConfirm={async () => {
          if (aQuitar) await eliminar(aQuitar.id)
          setAQuitar(null)
        }}
        onCancel={() => setAQuitar(null)}
      />

      {/* La línea se busca en `items` por id: así el diálogo ve la versión recién recargada. */}
      <CompraDialog
        open={!!compraDialog}
        item={compraDialog ? items.find((i) => i.id === compraDialog.item.id) ?? compraDialog.item : null}
        compra={compraDialog?.compra ?? null}
        onClose={() => setCompraDialog(null)}
        onGuardar={guardarCompra}
      />

      <ConfirmDialog
        open={!!compraABorrar}
        title="Borrar compra"
        message={compraABorrar ? `¿Borrar la compra del ${compraABorrar.compra.fecha.split('-').reverse().join('/')} de "${compraABorrar.item.nombre}"? Se recalculan lo llevado y el precio promedio.` : ''}
        confirmLabel="Borrar"
        onConfirm={async () => {
          if (compraABorrar) await borrarCompra(compraABorrar.item.id, compraABorrar.compra.id)
          setCompraABorrar(null)
        }}
        onCancel={() => setCompraABorrar(null)}
      />

      <CatalogoAdminDialog
        open={adminAbierto}
        unidades={unidades}
        rubros={rubros}
        onClose={() => setAdminAbierto(false)}
        onRenombrar={renombrarOpcion}
        onBorrar={borrarOpcion}
        onFijarSubunidad={fijarSubunidad}
      />
    </Box>
  )
}
