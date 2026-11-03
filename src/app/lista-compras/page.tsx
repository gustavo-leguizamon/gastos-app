'use client'

import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import IconButton from '@mui/material/IconButton'
import Autocomplete from '@mui/material/Autocomplete'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import SettingsIcon from '@mui/icons-material/Settings'
import toast from 'react-hot-toast'
import TextField from '@/components/shared/AppTextField'
import { useGastosStore } from '@/store/gastosStore'
import CatalogoAdminDialog from '@/components/lista-compras/CatalogoAdminDialog'
import CatalogoSelect from '@/components/lista-compras/CatalogoSelect'
import { useListaCompras, type AltaItem, type CambioItem, type OpcionCatalogo } from '@/components/lista-compras/useListaCompras'
import { aPrecioBase, desdePrecioBase, variacionPrecio } from '@/lib/lista-compras-compute'
import type { ArticuloCatalogo, ListaCompraItem } from '@/lib/types'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

/** `"1,5"` o `"1.5"` → 1.5; vacío → `null`; basura → `NaN`. */
function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.')
  return t === '' ? null : Number(t)
}

function Fila({
  item,
  unidades,
  rubros,
  onCrearUnidad,
  onCrearRubro,
  onCambiar,
  onEliminar,
}: {
  item: ListaCompraItem
  unidades: OpcionCatalogo[]
  rubros: OpcionCatalogo[]
  onCrearUnidad: (nombre: string) => Promise<OpcionCatalogo | null>
  onCrearRubro: (nombre: string) => Promise<OpcionCatalogo | null>
  onCambiar: (id: number, c: CambioItem) => void
  onEliminar: (item: ListaCompraItem) => void
}) {
  const [cantidad, setCantidad] = useState(String(item.cantidad))
  // Con unidad g/ml el precio se carga y se ve por kg/litro; se guarda siempre por la unidad de la línea.
  const base = item.subunidad_de
  const verPrecio = (p: number | null) => (p == null ? '' : String(aPrecioBase(p, base)))
  const [precio, setPrecio] = useState(verPrecio(item.precio_unitario))
  const [llevo, setLlevo] = useState(String(item.cantidad_comprada))

  // Si el server devuelve otro valor (recarga, otro mes), el input lo sigue.
  useEffect(() => { setCantidad(String(item.cantidad)) }, [item.cantidad])
  useEffect(() => { setLlevo(String(item.cantidad_comprada)) }, [item.cantidad_comprada])
  useEffect(() => { setPrecio(verPrecio(item.precio_unitario)) }, [item.precio_unitario, item.subunidad_de]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Lo llevado es el acumulado (no el de una compra): se completa de a poco hasta llegar a la cantidad. */
  const guardarLlevo = () => {
    const n = parseNum(llevo)
    if (n == null || !Number.isFinite(n) || n < 0) {
      toast.error('La cantidad comprada no es válida')
      setLlevo(String(item.cantidad_comprada))
      return
    }
    if (n !== item.cantidad_comprada) onCambiar(item.id, { cantidad_comprada: n })
  }

  const guardarCantidad = () => {
    const n = parseNum(cantidad)
    if (n == null || !Number.isFinite(n) || n <= 0) {
      toast.error('La cantidad tiene que ser mayor a 0')
      setCantidad(String(item.cantidad))
      return
    }
    if (n !== item.cantidad) onCambiar(item.id, { cantidad: n })
  }

  const guardarPrecio = () => {
    const n = parseNum(precio)
    if (n !== null && (!Number.isFinite(n) || n < 0)) {
      toast.error('El precio no es válido')
      setPrecio(verPrecio(item.precio_unitario))
      return
    }
    const guardado = n == null ? null : desdePrecioBase(n, base)
    if (guardado !== item.precio_unitario) onCambiar(item.id, { precio_unitario: guardado })
  }

  const parcial = !item.comprado && item.cantidad_comprada > 0
  const progreso = Math.min(100, (item.cantidad_comprada / item.cantidad) * 100)
  const ref = item.referencia
  const variacion = variacionPrecio(item.precio_unitario, ref?.precio_unitario ?? null)

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexWrap: 'wrap',
        py: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
        opacity: item.comprado ? 0.65 : 1,
      }}
    >
      <Checkbox
        size="small"
        checked={item.comprado}
        indeterminate={parcial}
        onChange={(e) => onCambiar(item.id, { comprado: e.target.checked })}
        inputProps={{ 'aria-label': `Comprado: ${item.nombre}` }}
      />
      <Box sx={{ flex: '1 1 160px', minWidth: 140 }}>
        <Typography variant="body2" fontWeight={600} sx={{ textDecoration: item.comprado ? 'line-through' : 'none' }}>
          {item.nombre}
        </Typography>
        {(parcial || item.comprado) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 0.25 }}>
            <LinearProgress
              variant="determinate"
              value={progreso}
              color={item.comprado ? 'success' : 'warning'}
              sx={{ flex: 1, height: 6, borderRadius: 3 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {item.comprado
                ? 'Completo'
                : `Faltan ${item.faltante.toLocaleString('es-AR', { maximumFractionDigits: 3 })} ${item.unidad}`}
            </Typography>
          </Box>
        )}
        {ref ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Última vez: {fmtARS(aPrecioBase(ref.precio_unitario, base))}{base ? `/${base}` : ''} × {ref.cantidad.toLocaleString('es-AR')} ({String(ref.mes).padStart(2, '0')}/{ref.anio})
            {variacion != null && (
              <Box component="span" sx={{ ml: 0.5, color: variacion > 0 ? 'error.main' : variacion < 0 ? 'success.main' : 'text.secondary' }}>
                {variacion > 0 ? '▲' : variacion < 0 ? '▼' : '='} {Math.abs(variacion).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%
              </Box>
            )}
          </Typography>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Sin compras anteriores</Typography>
        )}
        {base && item.precio_unitario != null && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            = {fmtARS(item.precio_unitario)} por {item.unidad}
          </Typography>
        )}
      </Box>
      <Tooltip title="Se cambia en todos los meses: es del artículo">
        <Box sx={{ display: 'flex', gap: 1 }}>
          <CatalogoSelect
            label="Rubro"
            options={rubros}
            value={item.rubro_id}
            onChange={(id) => { if (id !== item.rubro_id) onCambiar(item.id, { rubro_id: id }) }}
            onCrear={onCrearRubro}
            clearable
            width={150}
          />
          <CatalogoSelect
            label="Unidad"
            options={unidades}
            value={item.unidad_id}
            onChange={(id) => { if (id != null && id !== item.unidad_id) onCambiar(item.id, { unidad_id: id }) }}
            onCrear={onCrearUnidad}
            width={110}
          />
        </Box>
      </Tooltip>
      <TextField
        size="small"
        label={`Llevo (${item.unidad})`}
        value={llevo}
        onChange={(e) => setLlevo(e.target.value)}
        onBlur={guardarLlevo}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        inputProps={{ inputMode: 'decimal' }}
        sx={{ width: 110 }}
      />
      <TextField
        size="small"
        label={`Necesito (${item.unidad})`}
        value={cantidad}
        onChange={(e) => setCantidad(e.target.value)}
        onBlur={guardarCantidad}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        inputProps={{ inputMode: 'decimal' }}
        sx={{ width: 120 }}
      />
      <TextField
        size="small"
        label={base ? `Precio por ${base}` : 'Precio unitario'}
        placeholder={ref ? String(aPrecioBase(ref.precio_unitario, base)) : ''}
        value={precio}
        onChange={(e) => setPrecio(e.target.value)}
        onBlur={guardarPrecio}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        inputProps={{ inputMode: 'decimal' }}
        sx={{ width: 140 }}
      />
      <Typography variant="body2" fontWeight={700} sx={{ width: 110, textAlign: 'right' }}>
        {item.total == null ? '—' : fmtARS(item.total)}
        {parcial && item.total_llevado != null && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 400 }}>
            llevo {fmtARS(item.total_llevado)}
          </Typography>
        )}
      </Typography>
      <Tooltip title="Quitar de este mes">
        <IconButton size="small" onClick={() => onEliminar(item)}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

export default function ListaComprasPage() {
  const { filtros, setFiltros } = useGastosStore()
  const { mes, anio } = filtros
  const {
    items, totales, catalogo, loading, unidades, rubros, crearUnidad, crearRubro,
    recargarOpciones, renombrarOpcion, borrarOpcion, fijarSubunidad,
    agregar, cambiar, eliminar, copiarDelMesAnterior,
  } = useListaCompras(mes, anio)

  const [nombre, setNombre] = useState('')
  const [unidadId, setUnidadId] = useState<number | null>(null)
  const [rubroId, setRubroId] = useState<number | null>(null)
  const [cantidad, setCantidad] = useState('1')
  const [precio, setPrecio] = useState('')
  const [adminAbierto, setAdminAbierto] = useState(false)
  const [sugerido, setSugerido] = useState<ArticuloCatalogo | null>(null)

  // Si la unidad elegida es g/ml, el precio del alta se tipea por kg/litro.
  const baseAlta = unidades.find((u) => u.id === unidadId)?.subunidad_de ?? null

  const prevMes = () => (mes === 1 ? setFiltros({ mes: 12, anio: anio - 1 }) : setFiltros({ mes: mes - 1 }))
  const nextMes = () => (mes === 12 ? setFiltros({ mes: 1, anio: anio + 1 }) : setFiltros({ mes: mes + 1 }))

  // Los artículos que ya están en la lista no se ofrecen de nuevo.
  const enLista = useMemo(() => new Set(items.map((i) => i.articulo_id)), [items])
  const opciones = useMemo(() => catalogo.filter((a) => !enLista.has(a.id)), [catalogo, enLista])
  // Unidad por defecto: "un" (viene sembrada); si no está, la primera disponible.
  // Si la unidad/rubro elegidos en el formulario se borraron, se limpian.
  useEffect(() => {
    if (unidadId != null && unidades.length && !unidades.some((u) => u.id === unidadId)) setUnidadId(null)
    if (rubroId != null && !rubros.some((r) => r.id === rubroId)) setRubroId(null)
  }, [unidades, rubros, unidadId, rubroId])

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

  const elegir = (a: ArticuloCatalogo | null) => {
    setSugerido(a)
    if (a) {
      setNombre(a.nombre)
      setUnidadId(a.unidad_id)
      setRubroId(a.rubro_id)
      setPrecio('')
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = nombre.trim()
    const c = parseNum(cantidad)
    const p = parseNum(precio)
    if (!n) return toast.error('Completá el nombre del artículo')
    if (c == null || !Number.isFinite(c) || c <= 0) return toast.error('La cantidad tiene que ser mayor a 0')
    if (p !== null && (!Number.isFinite(p) || p < 0)) return toast.error('El precio no es válido')
    if (unidadId == null) return toast.error('Elegí la unidad')
    const alta: AltaItem = { nombre: n, unidad_id: unidadId, rubro_id: rubroId, cantidad: c, precio_unitario: p == null ? null : desdePrecioBase(p, baseAlta) }
    if (await agregar(alta)) {
      setNombre(''); setCantidad('1'); setPrecio(''); setSugerido(null)
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

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Lista de compras</Typography>
          <Typography variant="body2" color="text.secondary">
            Lo que necesitás comprar en el mes, con el precio de la última vez como referencia
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton size="small" onClick={prevMes}><ChevronLeftIcon /></IconButton>
          <Typography variant="body1" fontWeight={600} sx={{ minWidth: 150, textAlign: 'center' }}>
            {MESES[mes - 1]} {anio}
          </Typography>
          <IconButton size="small" onClick={nextMes}><ChevronRightIcon /></IconButton>
        </Box>
      </Box>

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

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>Agregar artículo</Typography>
            <Button size="small" startIcon={<SettingsIcon />} onClick={() => { recargarOpciones(); setAdminAbierto(true) }}>
              Administrar unidades y rubros
            </Button>
          </Box>
          <Box component="form" onSubmit={submit} sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
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
              renderInput={(params) => <TextField {...params} size="small" label="Artículo" />}
              sx={{ flex: '1 1 220px', minWidth: 200 }}
            />
            <TextField size="small" label="Cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} inputProps={{ inputMode: 'decimal' }} sx={{ width: 110 }} />
            <CatalogoSelect label="Unidad" options={unidades} value={unidadId} onChange={setUnidadId} onCrear={crearUnidad} width={130} />
            <CatalogoSelect label="Rubro (opcional)" options={rubros} value={rubroId} onChange={setRubroId} onCrear={crearRubro} clearable width={190} />
            <TextField
              size="small"
              label={baseAlta ? `Precio por ${baseAlta} (opcional)` : 'Precio unitario (opcional)'}
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              inputProps={{ inputMode: 'decimal' }}
              sx={{ width: 180 }}
            />
            <Button type="submit" variant="contained" startIcon={<AddIcon />}>Agregar</Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle1" fontWeight={600}>Lista de {MESES[mes - 1]}</Typography>
            <Tooltip title="Trae los artículos y cantidades del último mes con lista. Los precios no se copian: quedan como referencia.">
              <Button size="small" startIcon={<ContentCopyIcon />} onClick={copiarDelMesAnterior}>
                Copiar del mes anterior
              </Button>
            </Tooltip>
          </Box>

          {!loading && items.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              No hay artículos en la lista de este mes. Agregalos arriba o copiá los del mes anterior.
            </Typography>
          )}

          {grupos.map(([rubroNombre, filas]) => (
            <Box key={rubroNombre} sx={{ mb: 2 }}>
              <Typography variant="overline" color="text.secondary" fontWeight={700}>{rubroNombre}</Typography>
              {filas.map((i) => (
                <Fila
                  key={i.id}
                  item={i}
                  unidades={unidades}
                  rubros={rubros}
                  onCrearUnidad={crearUnidad}
                  onCrearRubro={crearRubro}
                  onCambiar={cambiar}
                  onEliminar={(it) => eliminar(it.id)}
                />
              ))}
            </Box>
          ))}
        </CardContent>
      </Card>

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
