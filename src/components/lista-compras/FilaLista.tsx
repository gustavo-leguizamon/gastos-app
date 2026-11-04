'use client'

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Checkbox from '@mui/material/Checkbox'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { alpha, type Theme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import RemoveIcon from '@mui/icons-material/Remove'
import toast from 'react-hot-toast'
import TextField from '@/components/shared/AppTextField'
import { ajustarLlevo, aPrecioBase, desdePrecioBase, variacionPrecio } from '@/lib/lista-compras-compute'
import type { ListaCompraCompra, ListaCompraItem } from '@/lib/types'
import CatalogoSelect from './CatalogoSelect'
import { fmtARS, parseNum, precioCampo } from './formato'
import type { CambioItem, OpcionCatalogo } from './useListaCompras'

interface Props {
  item: ListaCompraItem
  unidades: OpcionCatalogo[]
  rubros: OpcionCatalogo[]
  onCrearUnidad: (nombre: string) => Promise<OpcionCatalogo | null>
  onCrearRubro: (nombre: string) => Promise<OpcionCatalogo | null>
  onCambiar: (id: number, c: CambioItem) => void
  onEliminar: (item: ListaCompraItem) => void
  /** Abre el diálogo para registrar una compra de la línea. */
  onRegistrarCompra: (item: ListaCompraItem) => void
  onEditarCompra: (item: ListaCompraItem, compra: ListaCompraCompra) => void
  onBorrarCompra: (item: ListaCompraItem, compra: ListaCompraCompra) => void
  /** Pantalla chica: fila apilada, con botones grandes y +/− en lo llevado. */
  compacta?: boolean
}

/** Estado local de los campos editables de una fila y sus guardados (comparten escritorio y móvil). */
function useCamposFila(item: ListaCompraItem, onCambiar: Props['onCambiar']) {
  // Con unidad g/ml el precio se carga y se ve por kg/litro; se guarda siempre por la unidad de la línea.
  const base = item.subunidad_de
  const verPrecio = (p: number | null) => (p == null ? '' : precioCampo(aPrecioBase(p, base)))
  const [cantidad, setCantidad] = useState(String(item.cantidad))
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

  /** Botones +/−: suman o restan un paso a lo que se ve en el campo y guardan al toque. */
  const ajustar = (direccion: 1 | -1) => {
    const actual = parseNum(llevo)
    const nuevo = ajustarLlevo(actual != null && Number.isFinite(actual) ? actual : item.cantidad_comprada, direccion, base)
    setLlevo(String(nuevo))
    onCambiar(item.id, { cantidad_comprada: nuevo })
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
    // Lo que se ve está redondeado a centavos: salir del campo sin tocarlo no pisa el guardado.
    if (precio === verPrecio(item.precio_unitario)) return
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
  const ref = item.referencia
  // Con compras registradas, lo llevado y el precio salen de ellas y no se editan a mano.
  const tiene = item.compras.length > 0
  return {
    tiene,
    base, cantidad, setCantidad, precio, setPrecio, llevo, setLlevo,
    guardarLlevo, guardarCantidad, guardarPrecio, ajustar,
    parcial,
    progreso: Math.min(100, (item.cantidad_comprada / item.cantidad) * 100),
    ref,
    variacion: variacionPrecio(item.precio_unitario, ref?.precio_unitario ?? null),
    placeholderPrecio: ref ? precioCampo(aPrecioBase(ref.precio_unitario, base)) : '',
    labelPrecio: tiene ? (base ? `Precio promedio por ${base}` : 'Precio promedio') : base ? `Precio por ${base}` : 'Precio unitario',
  }
}

const alEnter = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
}

/**
 * Nombre del artículo con edición en línea: el lápiz lo convierte en campo; Enter o salir del
 * campo guarda, Esc cancela. Renombra el artículo, así que el cambio se ve en todos los meses.
 */
function NombreArticulo({ item, onCambiar, variant }: { item: ListaCompraItem; onCambiar: Props['onCambiar']; variant: 'body1' | 'body2' }) {
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(item.nombre)
  const tachado = item.estado_cantidad === 'completo' ? 'line-through' : 'none'

  const abrir = () => { setNombre(item.nombre); setEditando(true) }
  const guardar = () => {
    setEditando(false)
    const n = nombre.trim().replace(/\s+/g, ' ')
    if (!n) { toast.error('El nombre no puede quedar vacío'); return }
    if (n !== item.nombre) onCambiar(item.id, { nombre: n })
  }

  if (editando) {
    return (
      <TextField
        size="small"
        autoFocus
        fullWidth
        label="Nombre del artículo"
        helperText="Se cambia en todos los meses"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') { setNombre(item.nombre); setEditando(false) }
        }}
        sx={{ my: 0.5 }}
      />
    )
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      <Typography variant={variant} fontWeight={600} sx={{ textDecoration: tachado, wordBreak: 'break-word' }}>
        {item.nombre}
      </Typography>
      <Tooltip title="Renombrar artículo">
        <IconButton size="small" onClick={abrir} aria-label={`Renombrar ${item.nombre}`} sx={{ p: 0.5 }}>
          <EditIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

/** Barra de progreso + "Faltan X u" cuando la compra está en curso o completa. */
function Progreso({ item, progreso }: { item: ListaCompraItem; progreso: number }) {
  const estado = item.estado_cantidad
  if (estado === 'sin_compras') return null
  const color = estado === 'por_encima' ? 'error' : estado === 'por_debajo' ? 'warning' : 'success'
  const n = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 3 })
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 0.25 }}>
      <LinearProgress variant="determinate" value={progreso} color={color} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
      <Typography variant="caption" color={`${color}.main`} fontWeight={estado === 'completo' ? 400 : 700} sx={{ whiteSpace: 'nowrap' }}>
        {estado === 'por_encima' && `⚠ Pasaste por ${n(item.exceso)} ${item.unidad}`}
        {estado === 'por_debajo' && `Faltan ${n(item.faltante)} ${item.unidad}`}
        {estado === 'completo' && 'Completo'}
      </Typography>
    </Box>
  )
}

/**
 * Resalte de la fila según lo llevado vs. lo pedido: se pasó → borde y fondo rojos; por debajo →
 * naranjas; justo o sin empezar → sin resalte. Es la parte que se ve de un vistazo en la lista.
 */
function estiloEstado(item: ListaCompraItem) {
  const color = item.estado_cantidad === 'por_encima' ? 'error' : item.estado_cantidad === 'por_debajo' ? 'warning' : null
  return color
    ? { borderLeftColor: `${color}.main`, bgcolor: (t: Theme) => alpha(t.palette[color].main, 0.07) }
    : { borderLeftColor: 'transparent' }
}

/** Referencia de la última compra (por kg/l si la unidad es g/ml) y precio por unidad de la línea. */
function Referencia({ item, c }: { item: ListaCompraItem; c: ReturnType<typeof useCamposFila> }) {
  const { ref, base, variacion } = c
  return (
    <>
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
    </>
  )
}


/** "dd/mm/aaaa" desde el `YYYY-MM-DD` guardado (sin pasar por Date: correría el día en UTC). */
const fechaCorta = (f: string) => f.split('-').reverse().join('/')

/** Botón que muestra/oculta el detalle de compras: "3 compras ▾". */
function ToggleCompras({ n, abierto, onClick }: { n: number; abierto: boolean; onClick: () => void }) {
  if (n === 0) return null
  return (
    <ButtonBase onClick={onClick} aria-expanded={abierto} sx={{ typography: 'caption', color: 'primary.main', fontWeight: 600, py: 0.5 }}>
      {n} compra{n === 1 ? '' : 's'} {abierto ? '▴' : '▾'}
    </ButtonBase>
  )
}

/** Compras de la línea (fecha, cantidad × precio) con editar/borrar y el promedio ponderado. */
function ComprasDetalle({
  item,
  onEditar,
  onBorrar,
}: {
  item: ListaCompraItem
  onEditar: (c: ListaCompraCompra) => void
  onBorrar: (c: ListaCompraCompra) => void
}) {
  const base = item.subunidad_de
  const conPrecio = item.compras.some((c) => c.precio_unitario != null)
  return (
    <Box sx={{ mt: 0.5, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
      {item.compras.map((c) => (
        <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 76 }}>{fechaCorta(c.fecha)}</Typography>
          <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
            {c.cantidad.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {item.unidad}
            {c.precio_unitario != null ? ` × ${fmtARS(aPrecioBase(c.precio_unitario, base))}${base ? `/${base}` : ''}` : ' · sin precio'}
          </Typography>
          <IconButton size="small" onClick={() => onEditar(c)} aria-label="Editar compra"><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" onClick={() => onBorrar(c)} aria-label="Borrar compra"><DeleteIcon fontSize="small" /></IconButton>
        </Box>
      ))}
      {conPrecio && item.precio_unitario != null && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Promedio ponderado: <b>{fmtARS(aPrecioBase(item.precio_unitario, base))}{base ? `/${base}` : ''}</b>
        </Typography>
      )}
    </Box>
  )
}

function FilaEscritorio({ item, unidades, rubros, onCrearUnidad, onCrearRubro, onCambiar, onEliminar, onRegistrarCompra, onEditarCompra, onBorrarCompra }: Props) {
  const c = useCamposFila(item, onCambiar)
  const [verCompras, setVerCompras] = useState(false)
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
        // Sólo se atenúa lo que quedó justo: lo que se pasó o falta tiene que seguir llamando la atención.
        opacity: item.estado_cantidad === 'completo' ? 0.65 : 1,
        borderLeft: '4px solid',
        pl: 0.5,
        ...estiloEstado(item),
      }}
    >
      <Checkbox
        size="small"
        checked={item.comprado}
        indeterminate={c.parcial}
        disabled={c.tiene}
        onChange={(e) => onCambiar(item.id, { comprado: e.target.checked })}
        inputProps={{ 'aria-label': `Comprado: ${item.nombre}` }}
      />
      <Box sx={{ flex: '1 1 160px', minWidth: 140 }}>
        <NombreArticulo item={item} onCambiar={onCambiar} variant="body2" />
        <Progreso item={item} progreso={c.progreso} />
        <Referencia item={item} c={c} />
        <ToggleCompras n={item.compras.length} abierto={verCompras} onClick={() => setVerCompras((v) => !v)} />
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
        value={c.llevo}
        onChange={(e) => c.setLlevo(e.target.value)}
        onBlur={c.guardarLlevo}
        onKeyDown={alEnter}
        inputProps={{ inputMode: 'decimal' }}
        disabled={c.tiene}
        sx={{ width: 110 }}
      />
      <TextField
        size="small"
        label={`Necesito (${item.unidad})`}
        value={c.cantidad}
        onChange={(e) => c.setCantidad(e.target.value)}
        onBlur={c.guardarCantidad}
        onKeyDown={alEnter}
        inputProps={{ inputMode: 'decimal' }}
        sx={{ width: 120 }}
      />
      <TextField
        size="small"
        label={c.labelPrecio}
        placeholder={c.placeholderPrecio}
        value={c.precio}
        onChange={(e) => c.setPrecio(e.target.value)}
        onBlur={c.guardarPrecio}
        onKeyDown={alEnter}
        inputProps={{ inputMode: 'decimal' }}
        disabled={c.tiene}
        sx={{ width: 140 }}
      />
      <Typography variant="body2" fontWeight={700} sx={{ width: 110, textAlign: 'right' }}>
        {item.total == null ? '—' : fmtARS(item.total)}
        {c.parcial && item.total_llevado != null && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 400 }}>
            llevo {fmtARS(item.total_llevado)}
          </Typography>
        )}
      </Typography>
      <Tooltip title="Registrar una compra (cantidad, precio y fecha)">
        <IconButton size="small" color="primary" onClick={() => onRegistrarCompra(item)} aria-label="Registrar compra">
          <AddShoppingCartIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Quitar de este mes">
        <IconButton size="small" onClick={() => onEliminar(item)}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {item.compras.length > 0 && (
        <Collapse in={verCompras} unmountOnExit sx={{ flexBasis: '100%' }}>
          <ComprasDetalle item={item} onEditar={(co) => onEditarCompra(item, co)} onBorrar={(co) => onBorrarCompra(item, co)} />
        </Collapse>
      )}
    </Box>
  )
}

/**
 * Fila para pantallas chicas: todo apilado a ancho completo, con áreas de toque de 40px, lo llevado
 * con botones +/− (en el súper se toca, no se tipea) y el rubro/unidad del artículo —que casi no
 * se toca— plegados detrás del texto "Rubro · unidad".
 */
function FilaCompacta({ item, unidades, rubros, onCrearUnidad, onCrearRubro, onCambiar, onEliminar, onRegistrarCompra, onEditarCompra, onBorrarCompra }: Props) {
  const c = useCamposFila(item, onCambiar)
  const [editandoArticulo, setEditandoArticulo] = useState(false)
  const [verCompras, setVerCompras] = useState(false)
  const botonPaso = { border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }

  return (
    <Box sx={{ py: 1.5, pl: 1, borderBottom: '1px solid', borderColor: 'divider', borderLeft: '4px solid', opacity: item.estado_cantidad === 'completo' ? 0.65 : 1, ...estiloEstado(item) }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
        <Checkbox
          checked={item.comprado}
          indeterminate={c.parcial}
          disabled={c.tiene}
          onChange={(e) => onCambiar(item.id, { comprado: e.target.checked })}
          inputProps={{ 'aria-label': `Comprado: ${item.nombre}` }}
          sx={{ mt: -0.5, ml: -1 }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <NombreArticulo item={item} onCambiar={onCambiar} variant="body1" />
          <ButtonBase
            onClick={() => setEditandoArticulo((v) => !v)}
            aria-label="Cambiar rubro y unidad"
            sx={{ typography: 'caption', color: 'text.secondary', gap: 0.5, py: 0.5 }}
          >
            {item.rubro ?? 'Sin rubro'} · {item.unidad} <EditIcon sx={{ fontSize: 13 }} />
          </ButtonBase>
        </Box>
        <IconButton onClick={() => onEliminar(item)} aria-label="Quitar de este mes" sx={{ mt: -0.5, mr: -1 }}>
          <DeleteIcon />
        </IconButton>
      </Box>

      <Collapse in={editandoArticulo} unmountOnExit>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, pb: 1 }}>
          <CatalogoSelect
            label="Rubro"
            options={rubros}
            value={item.rubro_id}
            onChange={(id) => { if (id !== item.rubro_id) onCambiar(item.id, { rubro_id: id }) }}
            onCrear={onCrearRubro}
            clearable
            width="100%"
          />
          <CatalogoSelect
            label="Unidad"
            options={unidades}
            value={item.unidad_id}
            onChange={(id) => { if (id != null && id !== item.unidad_id) onCambiar(item.id, { unidad_id: id }) }}
            onCrear={onCrearUnidad}
            width="100%"
          />
          <Typography variant="caption" color="text.secondary" sx={{ gridColumn: '1 / -1' }}>
            Se cambia en todos los meses: es del artículo.
          </Typography>
        </Box>
      </Collapse>

      <Progreso item={item} progreso={c.progreso} />
      <Referencia item={item} c={c} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
        {!c.tiene && (
          <IconButton onClick={() => c.ajustar(-1)} disabled={item.cantidad_comprada <= 0} aria-label="Restar lo llevado" sx={botonPaso}>
            <RemoveIcon />
          </IconButton>
        )}
        <TextField
          label={`Llevo (${item.unidad})`}
          value={c.llevo}
          onChange={(e) => c.setLlevo(e.target.value)}
          onBlur={c.guardarLlevo}
          onKeyDown={alEnter}
          inputProps={{ inputMode: 'decimal', style: { textAlign: 'center' } }}
          disabled={c.tiene}
          sx={{ flex: 1 }}
        />
        {!c.tiene && (
          <IconButton onClick={() => c.ajustar(1)} aria-label="Sumar lo llevado" sx={botonPaso}>
            <AddIcon />
          </IconButton>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1.5 }}>
        <TextField
          label={`Necesito (${item.unidad})`}
          value={c.cantidad}
          onChange={(e) => c.setCantidad(e.target.value)}
          onBlur={c.guardarCantidad}
          onKeyDown={alEnter}
          inputProps={{ inputMode: 'decimal' }}
        />
        <TextField
          label={c.labelPrecio}
          placeholder={c.placeholderPrecio}
          value={c.precio}
          onChange={(e) => c.setPrecio(e.target.value)}
          onBlur={c.guardarPrecio}
          onKeyDown={alEnter}
          inputProps={{ inputMode: 'decimal' }}
          disabled={c.tiene}
        />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {c.parcial && item.total_llevado != null ? `Llevo ${fmtARS(item.total_llevado)}` : ''}
        </Typography>
        <Typography variant="body1" fontWeight={700}>
          {item.total == null ? 'Total —' : `Total ${fmtARS(item.total)}`}
        </Typography>
      </Box>
      <Button variant="outlined" fullWidth startIcon={<AddShoppingCartIcon />} onClick={() => onRegistrarCompra(item)} sx={{ mt: 1.5, py: 1 }}>
        Registrar compra
      </Button>
      <ToggleCompras n={item.compras.length} abierto={verCompras} onClick={() => setVerCompras((v) => !v)} />
      {item.compras.length > 0 && (
        <Collapse in={verCompras} unmountOnExit>
          <ComprasDetalle item={item} onEditar={(co) => onEditarCompra(item, co)} onBorrar={(co) => onBorrarCompra(item, co)} />
        </Collapse>
      )}
    </Box>
  )
}

export default function FilaLista(props: Props) {
  return props.compacta ? <FilaCompacta {...props} /> : <FilaEscritorio {...props} />
}
