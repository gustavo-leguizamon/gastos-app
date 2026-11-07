'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import toast from 'react-hot-toast'
import TextField from '@/components/shared/AppTextField'
import { fmtARS, hoyLocal, parseNum, precioCampo } from '@/components/lista-compras/formato'
import type { OpcionCatalogo } from '@/components/lista-compras/useListaCompras'
import CampoCantidad from '@/components/lista-compras/CampoCantidad'
import CampoPrecio from '@/components/lista-compras/CampoPrecio'
import { aCantidadBase, desdeCantidadBase, entradaDePrecio, esUnidadMultiplo, normalizarBusqueda, precargaCompra, precioUnitarioDeEntrada, type ModoPrecio, type SubunidadDe } from '@/lib/lista-compras-compute'
import { mejorCoincidencia } from '@/lib/lista-compras-match'
import { fechaDeTicket, parseLineasOcr } from '@/lib/lista-compras-ocr'
import type { ArticuloCatalogo, ListaCompraItem } from '@/lib/types'

/**
 * Lo que el diálogo le entrega a la página: o un artículo para dar de alta en la lista del mes, o una
 * compra para una línea que ya está en ella.
 */
export type ImportItem =
  /** `comprar`: registrar la compra aunque no tenga precio (carga manual: lo cargado ya se compró). */
  | { tipo: 'alta'; nombre: string; unidad_id: number; rubro_id: number | null; cantidad: number; precio_unitario: number | null; comprar?: boolean }
  | { tipo: 'compra'; item_id: number; cantidad: number; precio_unitario: number | null }

interface Fila {
  key: number
  incluir: boolean
  /** Texto tal como lo leyó el OCR. */
  leido: string
  /** Artículo propio al que se mapeó (o lo escrito, si es uno nuevo). */
  nombre: string
  /** Cantidad que leyó el OCR: es la de una compra. La de un alta sale de la última usada. */
  cantLeida: number
  cantidad: string
  /** La cantidad está en kg/l (se registra ×1000 en g/ml). */
  kg: boolean
  /** kg/l si el OCR leyó la cantidad en kg o litros ("2 kg manzanas"). */
  multLeido: SubunidadDe | null
  unidadId: number
  rubroId: number | null
  /** Importe del ticket (total de la línea). */
  total: number | null
  /** Precio tal como se tipea: por unidad (por kg/litro en g/ml) o total pagado, según `modo`. Vacío = sin precio. */
  precio: string
  modo: ModoPrecio
  /** Carga manual: artículo cuyos datos ya se precargaron (re-elegirlo no pisa lo tipeado). */
  precargadoDe?: number
}

type Fase = 'elegir' | 'leyendo' | 'revisar'

/** Lado mayor máximo antes de reconocer: una foto de 12 Mpx hace el OCR lentísimo y no lo mejora. */
const LADO_MAX = 2000

/** Reduce la imagen (sin agrandarla) a un PNG en escala de grises, que es lo que mejor lee el OCR. */
async function prepararImagen(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bmp.width * escala))
  canvas.height = Math.max(1, Math.round(bmp.height * escala))
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.filter = 'grayscale(1) contrast(1.2)'
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close?.()
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/png'))
}

interface Props {
  open: boolean
  /**
   * `imagen` (default): se lee una foto con OCR. `manual`: se arranca directo en la revisión con
   * filas vacías, para cargar a mano varias compras del mismo día.
   */
  origen?: 'imagen' | 'manual'
  unidades: OpcionCatalogo[]
  rubros: OpcionCatalogo[]
  catalogo: ArticuloCatalogo[]
  /** Líneas de la lista del mes: si el artículo ya está, se registra una compra en vez de un alta. */
  items: ListaCompraItem[]
  onClose: () => void
  onImportar: (items: ImportItem[], fecha: string) => Promise<void>
}

/**
 * Carga artículos desde una foto: una lista escrita o un ticket. El OCR corre en el navegador
 * (la imagen no sale del dispositivo). Lo leído se **mapea al artículo propio más parecido**
 * (`mejorCoincidencia`), que precarga su unidad, rubro y última cantidad; si el artículo ya está en
 * la lista del mes se registra una **compra** (con el precio y la fecha del ticket) en vez de un alta.
 * Todo pasa por una revisión editable, porque el OCR se equivoca.
 */
export default function ImagenDialog({ open, origen = 'imagen', unidades, rubros, catalogo, items, onClose, onImportar }: Props) {
  const theme = useTheme()
  const compacta = useMediaQuery(theme.breakpoints.down('md'))
  const [fase, setFase] = useState<Fase>('elegir')
  const [progreso, setProgreso] = useState(0)
  const [filas, setFilas] = useState<Fila[]>([])
  const [guardando, setGuardando] = useState(false)
  const [textoVacio, setTextoVacio] = useState(false)
  const [fecha, setFecha] = useState(hoyLocal())
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelado = useRef(false)
  const manual = origen === 'manual'
  /** Claves de las filas agregadas a mano (las del OCR usan el índice de la línea leída). */
  const siguienteKey = useRef(100000)
  /** Fila recién agregada a mano: recibe el foco. */
  const [focoKey, setFocoKey] = useState<number | null>(null)

  const unidadDefault = () => (unidades.find((u) => u.nombre.toLowerCase() === 'un') ?? unidades[0])?.id
  const filaVacia = (): Fila => {
    const unidadId = unidadDefault() ?? 0
    return {
      key: siguienteKey.current++, incluir: true, leido: '', nombre: '', cantLeida: 0, cantidad: '', kg: false,
      multLeido: null, unidadId, rubroId: null, total: null, precio: '', modo: baseDe(unidadId) ? 'total' : 'unitario',
    }
  }

  // Al cerrar se vuelve a empezar: la próxima foto no hereda la revisión anterior. La carga manual
  // abre directo en la revisión, con una fila vacía y la fecha de hoy.
  useEffect(() => {
    if (open) {
      if (manual) {
        const fila = filaVacia()
        setFilas([fila]); setFocoKey(fila.key); setFecha(hoyLocal()); setTextoVacio(false); setFase('revisar')
      }
      return
    }
    cancelado.current = true
    setFase('elegir'); setFilas([]); setProgreso(0); setTextoVacio(false); setFocoKey(null)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const porNombre = useMemo(() => new Map(catalogo.map((a) => [normalizarBusqueda(a.nombre), a])), [catalogo])
  const conocido = (nombre: string) => porNombre.get(normalizarBusqueda(nombre)) ?? null
  const lineaDe = (art: ArticuloCatalogo | null) => (art ? items.find((i) => i.articulo_id === art.id) ?? null : null)

  /** Qué se hace con una fila: compra (artículo ya en la lista), alta (artículo propio) o alta de uno nuevo. */
  const tipoDe = (f: Fila): 'compra' | 'alta' | 'nuevo' => {
    const art = conocido(f.nombre)
    return !art ? 'nuevo' : lineaDe(art) ? 'compra' : 'alta'
  }

  const baseDe = (unidadId: number) => unidades.find((u) => u.id === unidadId)?.subunidad_de ?? null
  const unidadNombre = (unidadId: number) => unidades.find((u) => u.id === unidadId)?.nombre ?? ''
  /** Precio inicial de una fila: el importe del ticket como "total pagado"; sin importe, vacío. */
  const precioInicial = (total: number | null, unidadId: number): Pick<Fila, 'precio' | 'modo'> =>
    total != null
      ? { precio: String(total), modo: 'total' }
      : { precio: '', modo: baseDe(unidadId) ? 'total' : 'unitario' }

  /** Lo que se precarga al elegir un artículo propio: unidad, rubro y la última cantidad usada. */
  const datosDe = (art: ArticuloCatalogo, cantLeida: number, multLeido: SubunidadDe | null) => {
    // Una compra lleva lo que dice la imagen; un alta, lo que se pidió la última vez (ya en g/ml).
    const base = baseDe(art.unidad_id)
    // "2 kg" de un artículo en g: se muestra 2 con kg elegido (se registra 2000).
    if (!!lineaDe(art) || art.ultima_cantidad == null) {
      const kg = base != null && (multLeido != null ? multLeido === base : art.mostrar_en_multiplo)
      // Leído sin unidad en un artículo que se ve en kg: lo leído ya se toma en kg.
      return { unidadId: art.unidad_id, rubroId: art.rubro_id, cantidad: String(cantLeida), kg }
    }
    // La última cantidad está guardada en g/ml: se muestra en la unidad que prefiere el artículo.
    const kg = art.mostrar_en_multiplo && base != null
    return { unidadId: art.unidad_id, rubroId: art.rubro_id, cantidad: String(desdeCantidadBase(art.ultima_cantidad, kg)), kg }
  }

  /**
   * Carga manual: lo que se precarga al elegir un artículo propio, igual que al registrar una compra
   * (`precargaCompra`): lo que falta de su línea y el último precio conocido.
   */
  const datosManual = (art: ArticuloCatalogo): Partial<Fila> => {
    const base = baseDe(art.unidad_id)
    const kg = art.mostrar_en_multiplo && base != null
    const modo: ModoPrecio = base ? 'total' : 'unitario'
    const p = precargaCompra(lineaDe(art), art)
    const entrada = p.precio_unitario == null ? null : entradaDePrecio(modo, p.precio_unitario, p.cantidad, base)
    return {
      precargadoDe: art.id, unidadId: art.unidad_id, rubroId: art.rubro_id, kg, modo,
      cantidad: p.cantidad == null ? '' : String(desdeCantidadBase(p.cantidad, kg)),
      precio: entrada == null ? '' : precioCampo(entrada),
    }
  }

  const agregarFila = () => {
    const fila = filaVacia()
    setFilas((prev) => [...prev, fila])
    setFocoKey(fila.key)
  }
  const quitarFila = (key: number) => setFilas((prev) => prev.filter((f) => f.key !== key))

  const armarFilas = (texto: string): Fila[] => {
    const porArticulo = new Map<number, Fila>()
    const out: Fila[] = []
    // kg, l y m no son unidades de artículo, pero se leen para cargar la cantidad en kg/l/m.
    parseLineasOcr(texto, [...unidades.map((u) => u.nombre), 'kg', 'l', 'm']).forEach((c, i) => {
      const multLeido = c.unidad ? esUnidadMultiplo(c.unidad) : null
      // Se mapea al artículo propio más parecido a lo leído; si ninguno se parece, queda como se leyó.
      const m = mejorCoincidencia(c.nombre, catalogo)
      const art = m ? catalogo.find((a) => a.id === m.id) ?? null : null
      if (art) {
        const previa = porArticulo.get(art.id)
        if (previa) {
          // Dos renglones del mismo artículo: una sola fila, sumando.
          previa.cantLeida += c.cantidad
          previa.total = previa.total == null && c.total == null ? null : (previa.total ?? 0) + (c.total ?? 0)
          if (previa.total != null) { previa.precio = String(previa.total); previa.modo = 'total' }
          if (lineaDe(art)) previa.cantidad = String(previa.cantLeida)
          return
        }
        const fila: Fila = { key: i, incluir: true, leido: c.nombre, nombre: art.nombre, cantLeida: c.cantidad, multLeido, total: c.total, ...datosDe(art, c.cantidad, multLeido), ...precioInicial(c.total, art.unidad_id) }
        porArticulo.set(art.id, fila)
        out.push(fila)
        return
      }
      // Leído en kg/l: la unidad es la g/ml que le corresponde, con la cantidad cargada en kg/l.
      const unidadLeida = multLeido
        ? unidades.find((u) => u.subunidad_de === multLeido)?.id
        : c.unidad ? unidades.find((u) => u.nombre === c.unidad)?.id : undefined
      const unidadId = unidadLeida ?? unidadDefault()
      if (unidadId == null) return
      // Sin coincidencia: no se agrega solo; hay que elegir un artículo propio o confirmarlo como nuevo.
      out.push({ key: i, incluir: false, leido: c.nombre, nombre: c.nombre, cantLeida: c.cantidad, multLeido, total: c.total, cantidad: String(c.cantidad), kg: multLeido != null && baseDe(unidadId) === multLeido, unidadId, rubroId: null, ...precioInicial(c.total, unidadId) })
    })
    return out
  }

  const leer = async (file: File) => {
    cancelado.current = false
    setFase('leyendo'); setProgreso(0); setTextoVacio(false); setFecha(hoyLocal())
    try {
      const imagen = await prepararImagen(file)
      // Carga diferida: tesseract pesa y sólo se necesita acá.
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('spa', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') setProgreso(m.progress)
        },
      })
      try {
        const { data } = await worker.recognize(imagen)
        if (cancelado.current) return
        const resultado = armarFilas(data.text)
        setFilas(resultado)
        setFecha(fechaDeTicket(data.text, hoyLocal()) ?? hoyLocal())
        setTextoVacio(resultado.length === 0)
        setFase('revisar')
      } finally {
        await worker.terminate()
      }
    } catch {
      if (cancelado.current) return
      toast.error('No se pudo leer la imagen. Probá con otra foto, más nítida y de frente.')
      setFase('elegir')
    }
  }

  const cambiar = (key: number, cambio: Partial<Fila>) =>
    setFilas((prev) => prev.map((f) => (f.key === key ? { ...f, ...cambio } : f)))

  /** Se eligió (o se escribió) un artículo: si es uno propio se precargan sus datos y la fila se incluye. */
  const elegir = (f: Fila, valor: string) => {
    const art = conocido(valor)
    if (!art) return cambiar(f.key, { nombre: valor, precargadoDe: undefined })
    // Mismo artículo que ya estaba elegido (el blur re-dispara el onChange): no se pisa lo tipeado.
    if (manual && f.precargadoDe === art.id) return cambiar(f.key, { nombre: art.nombre })
    cambiar(f.key, { nombre: art.nombre, incluir: true, ...(manual ? datosManual(art) : datosDe(art, f.cantLeida, f.multLeido)) })
  }

  /** Cantidad de la fila en la unidad del artículo (g/ml…), que es como se registra; `null` si no es válida. */
  const cantidadDe = (f: Fila): number | null => {
    const c = parseNum(f.cantidad)
    return c != null && Number.isFinite(c) ? aCantidadBase(c, f.kg && baseDe(f.unidadId) != null) : null
  }

  /** Al cambiar entre unitario y total el campo se convierte: no queda un número con otro significado. */
  const cambiarModo = (f: Fila, nuevo: ModoPrecio) => {
    const cant = cantidadDe(f)
    const p = parseNum(f.precio)
    let precio = f.precio
    if (p != null && Number.isFinite(p) && p >= 0) {
      const base = baseDe(f.unidadId)
      const unitario = precioUnitarioDeEntrada(f.modo, p, cant, base)
      const entrada = unitario == null ? null : entradaDePrecio(nuevo, unitario, cant, base)
      if (entrada != null) precio = String(entrada)
    }
    cambiar(f.key, { modo: nuevo, precio })
  }

  /** Precio por la unidad de la línea (lo que se guarda); `null` si no se cargó o no se puede calcular. */
  const precioDe = (f: Fila): number | null => {
    const p = parseNum(f.precio)
    if (p == null || !Number.isFinite(p) || p < 0) return null
    return precioUnitarioDeEntrada(f.modo, p, cantidadDe(f), baseDe(f.unidadId))
  }
  const precioInvalido = (f: Fila) => {
    const p = parseNum(f.precio)
    return p != null && (!Number.isFinite(p) || p < 0)
  }

  /** Fila manual sin tocar: se ignora en vez de marcarla como error. */
  const vacia = (f: Fila) => manual && !f.nombre.trim() && !f.cantidad.trim()
  const seleccionadas = filas.filter((f) => f.incluir && !vacia(f))
  const invalida = (f: Fila) => {
    const c = parseNum(f.cantidad)
    return !f.nombre.trim() || c == null || !Number.isFinite(c) || c <= 0
  }

  const importar = async () => {
    if (seleccionadas.some(invalida)) return toast.error('Revisá los nombres y cantidades marcados')
    if (seleccionadas.some(precioInvalido)) return toast.error('Hay un precio que no es válido')
    if (!fecha) return toast.error('Completá la fecha de la compra')
    setGuardando(true)
    try {
      const out: ImportItem[] = seleccionadas.map((f) => {
        const cantidad = cantidadDe(f) as number
        const linea = lineaDe(conocido(f.nombre))
        const precio = precioDe(f)
        if (linea) return { tipo: 'compra', item_id: linea.id, cantidad, precio_unitario: precio }
        return {
          tipo: 'alta', nombre: f.nombre.trim(), unidad_id: f.unidadId, rubro_id: f.rubroId, cantidad,
          precio_unitario: precio, comprar: manual,
        }
      })
      await onImportar(out, fecha)
      onClose()
    } finally {
      setGuardando(false)
    }
  }

  const estado = (f: Fila) => {
    const t = tipoDe(f)
    if (t === 'compra') return <Chip size="small" color="success" variant="outlined" label="Ya está en la lista: se registra la compra" />
    if (manual) {
      if (!f.nombre.trim()) return null
      if (t === 'alta') return <Chip size="small" color="primary" variant="outlined" label="No está en la lista: se agrega como comprado" />
      return <Chip size="small" color="warning" variant="outlined" label="Artículo nuevo: se crea y se agrega como comprado" />
    }
    if (t === 'alta') return <Chip size="small" color="primary" variant="outlined" label="Se agrega a la lista" />
    return <Chip size="small" color="warning" variant="outlined" label="Sin coincidencia: se crea como artículo nuevo" />
  }

  return (
    <Dialog open={open} onClose={onClose} fullScreen={compacta} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700 }}>
        {manual ? 'Cargar varias compras' : 'Cargar desde una imagen'}
        <IconButton onClick={onClose} aria-label="Cerrar"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = '' // permite volver a elegir la misma foto
            if (f) leer(f)
          }}
        />

        {fase === 'elegir' && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Sacá o elegí una foto de una <b>lista escrita</b> o de un <b>ticket</b>. Lo que se lee se asocia a tus
              artículos más parecidos (con su unidad, rubro y última cantidad); si ya están en la lista del mes se
              registra la compra. La imagen no se sube a ningún lado y revisás todo antes de agregar.
            </Typography>
            <Button variant="contained" size="large" startIcon={<PhotoCameraIcon />} onClick={() => inputRef.current?.click()}>
              Elegir o sacar foto
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              La primera vez descarga el reconocimiento de texto (unos MB). Funciona mejor con texto impreso, bien
              iluminado y de frente; la letra a mano puede leerse mal.
            </Typography>
          </Box>
        )}

        {fase === 'leyendo' && (
          <Box sx={{ py: 4 }}>
            <Typography sx={{ mb: 1 }}>Leyendo la imagen…</Typography>
            <LinearProgress variant={progreso > 0 ? 'determinate' : 'indeterminate'} value={progreso * 100} />
          </Box>
        )}

        {fase === 'revisar' && (
          <>
            {manual ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Cargá todo lo que compraste el mismo día. Si el artículo ya está en la lista del mes se registra la
                compra; si no, se agrega a la lista como comprado. El precio es opcional.
              </Typography>
            ) : textoVacio ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                No se detectó ningún artículo. Probá con una foto más nítida y de frente.
              </Alert>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Se detectaron {filas.length} línea(s). Elegí el artículo correcto en las que no coincidan y destildá
                lo que no corresponda.
              </Typography>
            )}

            {(filas.length > 0 || manual) && (
              <TextField
                size="small"
                type="date"
                label="Fecha de la compra"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2, width: { xs: '100%', md: 220 } }}
              />
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {filas.map((f) => {
                const art = conocido(f.nombre)
                return (
                  <Box
                    key={f.key}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: 'auto 1fr 84px', md: 'auto 1fr 90px 110px 150px' },
                      gap: 1,
                      alignItems: 'center',
                      opacity: f.incluir ? 1 : 0.6,
                      pb: 1.5,
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    {manual ? (
                      <IconButton size="small" onClick={() => quitarFila(f.key)} aria-label="Quitar fila" sx={{ p: 0.5 }}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    ) : (
                      <Checkbox checked={f.incluir} onChange={(e) => cambiar(f.key, { incluir: e.target.checked })} sx={{ p: 0.5 }} />
                    )}
                    <Autocomplete
                      freeSolo
                      autoSelect
                      size="small"
                      options={catalogo.map((a) => a.nombre)}
                      value={f.nombre}
                      onChange={(_, v) => elegir(f, v ?? '')}
                      onInputChange={(_, v, reason) => { if (reason === 'input') cambiar(f.key, { nombre: v }) }}
                      renderInput={(params) => (
                        <TextField {...params} label="Artículo" autoFocus={f.key === focoKey} error={f.incluir && !vacia(f) && !f.nombre.trim()} />
                      )}
                    />
                    <CampoCantidad
                      label="Cant."
                      value={f.cantidad}
                      onChange={(v) => cambiar(f.key, { cantidad: v })}
                      multiplo={f.kg && baseDe(f.unidadId) != null}
                      onMultiplo={(kg) => cambiar(f.key, { kg })}
                      unidad={unidadNombre(f.unidadId)}
                      base={baseDe(f.unidadId)}
                      error={f.incluir && !vacia(f) && invalida(f)}
                    />
                    <TextField
                      select
                      size="small"
                      label="Unidad"
                      value={f.unidadId}
                      disabled={!!art}
                      onChange={(e) => cambiar(f.key, { unidadId: Number(e.target.value) })}
                      sx={{ gridColumn: { xs: '2 / 3', md: 'auto' } }}
                    >
                      {unidades.map((u) => <MenuItem key={u.id} value={u.id}>{u.nombre}</MenuItem>)}
                    </TextField>
                    <TextField
                      select
                      size="small"
                      label="Rubro"
                      value={f.rubroId ?? ''}
                      disabled={!!art}
                      onChange={(e) => cambiar(f.key, { rubroId: e.target.value === '' ? null : Number(e.target.value) })}
                      sx={{ gridColumn: { xs: '3 / 4', md: 'auto' } }}
                    >
                      <MenuItem value=""><em>Sin rubro</em></MenuItem>
                      {rubros.map((r) => <MenuItem key={r.id} value={r.id}>{r.nombre}</MenuItem>)}
                    </TextField>
                    <CampoPrecio
                      modo={f.modo}
                      onModo={(m) => cambiarModo(f, m)}
                      value={f.precio}
                      onChange={(v) => cambiar(f.key, { precio: v })}
                      base={baseDe(f.unidadId)}
                      unidad={unidadNombre(f.unidadId)}
                      cantidad={cantidadDe(f)}
                      opcional
                      sx={{ gridColumn: { xs: '2 / 4', md: '2 / 6' } }}
                    />
                    <Box sx={{ gridColumn: { xs: '2 / 4', md: '2 / 6' }, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mt: -0.5 }}>
                      {estado(f)}
                      {!manual && (
                        <Typography variant="caption" color="text.secondary">
                          Leído: “{f.leido}”{f.total != null ? ` · ${fmtARS(f.total)}` : ''}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )
              })}
            </Box>
            {manual && (
              <Button startIcon={<AddIcon />} onClick={agregarFila} sx={{ mt: 1.5 }}>
                Agregar otro artículo
              </Button>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {fase === 'revisar' && !manual && (
          <Button onClick={() => { setFase('elegir'); setFilas([]) }} disabled={guardando} sx={{ mr: 'auto' }}>
            Otra imagen
          </Button>
        )}
        <Button onClick={onClose} disabled={guardando}>Cancelar</Button>
        {fase === 'revisar' && (
          <Button variant="contained" onClick={importar} disabled={guardando || seleccionadas.length === 0}>
            {guardando ? 'Guardando…' : manual ? `Registrar ${seleccionadas.length}` : `Aceptar ${seleccionadas.length}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
