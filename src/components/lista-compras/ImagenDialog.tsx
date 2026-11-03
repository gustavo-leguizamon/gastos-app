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
import CloseIcon from '@mui/icons-material/Close'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import toast from 'react-hot-toast'
import TextField from '@/components/shared/AppTextField'
import { fmtARS, hoyLocal, parseNum } from '@/components/lista-compras/formato'
import type { OpcionCatalogo } from '@/components/lista-compras/useListaCompras'
import CampoPrecio from '@/components/lista-compras/CampoPrecio'
import { entradaDePrecio, normalizarBusqueda, precioUnitarioDeEntrada, type ModoPrecio } from '@/lib/lista-compras-compute'
import { mejorCoincidencia } from '@/lib/lista-compras-match'
import { fechaDeTicket, parseLineasOcr } from '@/lib/lista-compras-ocr'
import type { ArticuloCatalogo, ListaCompraItem } from '@/lib/types'

/**
 * Lo que el diálogo le entrega a la página: o un artículo para dar de alta en la lista del mes, o una
 * compra para una línea que ya está en ella.
 */
export type ImportItem =
  | { tipo: 'alta'; nombre: string; unidad_id: number; rubro_id: number | null; cantidad: number; precio_unitario: number | null }
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
  unidadId: number
  rubroId: number | null
  /** Importe del ticket (total de la línea). */
  total: number | null
  /** Precio tal como se tipea: por unidad (por kg/litro en g/ml) o total pagado, según `modo`. Vacío = sin precio. */
  precio: string
  modo: ModoPrecio
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
export default function ImagenDialog({ open, unidades, rubros, catalogo, items, onClose, onImportar }: Props) {
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

  // Al cerrar se vuelve a empezar: la próxima foto no hereda la revisión anterior.
  useEffect(() => {
    if (open) return
    cancelado.current = true
    setFase('elegir'); setFilas([]); setProgreso(0); setTextoVacio(false)
  }, [open])

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
  const datosDe = (art: ArticuloCatalogo, cantLeida: number) => ({
    unidadId: art.unidad_id,
    rubroId: art.rubro_id,
    // Una compra lleva lo que dice la imagen; un alta, lo que se pidió la última vez.
    cantidad: String(lineaDe(art) ? cantLeida : art.ultima_cantidad ?? cantLeida),
  })

  const armarFilas = (texto: string): Fila[] => {
    const unidadDefault = (unidades.find((u) => u.nombre.toLowerCase() === 'un') ?? unidades[0])?.id
    const porArticulo = new Map<number, Fila>()
    const out: Fila[] = []
    parseLineasOcr(texto, unidades.map((u) => u.nombre)).forEach((c, i) => {
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
        const fila: Fila = { key: i, incluir: true, leido: c.nombre, nombre: art.nombre, cantLeida: c.cantidad, total: c.total, ...datosDe(art, c.cantidad), ...precioInicial(c.total, art.unidad_id) }
        porArticulo.set(art.id, fila)
        out.push(fila)
        return
      }
      const unidadLeida = c.unidad ? unidades.find((u) => u.nombre === c.unidad)?.id : undefined
      const unidadId = unidadLeida ?? unidadDefault
      if (unidadId == null) return
      // Sin coincidencia: no se agrega solo; hay que elegir un artículo propio o confirmarlo como nuevo.
      out.push({ key: i, incluir: false, leido: c.nombre, nombre: c.nombre, cantLeida: c.cantidad, total: c.total, cantidad: String(c.cantidad), unidadId, rubroId: null, ...precioInicial(c.total, unidadId) })
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
    cambiar(f.key, art ? { nombre: art.nombre, incluir: true, ...datosDe(art, f.cantLeida) } : { nombre: valor })
  }

  /** Al cambiar entre unitario y total el campo se convierte: no queda un número con otro significado. */
  const cambiarModo = (f: Fila, nuevo: ModoPrecio) => {
    const c = parseNum(f.cantidad)
    const cant = c != null && Number.isFinite(c) ? c : null
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
    const c = parseNum(f.cantidad)
    if (p == null || !Number.isFinite(p) || p < 0) return null
    return precioUnitarioDeEntrada(f.modo, p, c != null && Number.isFinite(c) ? c : null, baseDe(f.unidadId))
  }
  const precioInvalido = (f: Fila) => {
    const p = parseNum(f.precio)
    return p != null && (!Number.isFinite(p) || p < 0)
  }

  const seleccionadas = filas.filter((f) => f.incluir)
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
        const cantidad = parseNum(f.cantidad) as number
        const linea = lineaDe(conocido(f.nombre))
        const precio = precioDe(f)
        if (linea) return { tipo: 'compra', item_id: linea.id, cantidad, precio_unitario: precio }
        return {
          tipo: 'alta', nombre: f.nombre.trim(), unidad_id: f.unidadId, rubro_id: f.rubroId, cantidad,
          precio_unitario: precio,
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
    if (t === 'alta') return <Chip size="small" color="primary" variant="outlined" label="Se agrega a la lista" />
    return <Chip size="small" color="warning" variant="outlined" label="Sin coincidencia: se crea como artículo nuevo" />
  }

  return (
    <Dialog open={open} onClose={onClose} fullScreen={compacta} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700 }}>
        Cargar desde una imagen
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
            {textoVacio ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                No se detectó ningún artículo. Probá con una foto más nítida y de frente.
              </Alert>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Se detectaron {filas.length} línea(s). Elegí el artículo correcto en las que no coincidan y destildá
                lo que no corresponda.
              </Typography>
            )}

            {filas.length > 0 && (
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
                    <Checkbox checked={f.incluir} onChange={(e) => cambiar(f.key, { incluir: e.target.checked })} sx={{ p: 0.5 }} />
                    <Autocomplete
                      freeSolo
                      autoSelect
                      size="small"
                      options={catalogo.map((a) => a.nombre)}
                      value={f.nombre}
                      onChange={(_, v) => elegir(f, v ?? '')}
                      onInputChange={(_, v, reason) => { if (reason === 'input') cambiar(f.key, { nombre: v }) }}
                      renderInput={(params) => (
                        <TextField {...params} label="Artículo" error={f.incluir && !f.nombre.trim()} />
                      )}
                    />
                    <TextField
                      size="small"
                      label="Cant."
                      value={f.cantidad}
                      onChange={(e) => cambiar(f.key, { cantidad: e.target.value })}
                      inputProps={{ inputMode: 'decimal' }}
                      error={f.incluir && invalida(f)}
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
                      cantidad={(() => { const c = parseNum(f.cantidad); return c != null && Number.isFinite(c) ? c : null })()}
                      opcional
                      sx={{ gridColumn: { xs: '2 / 4', md: '2 / 6' } }}
                    />
                    <Box sx={{ gridColumn: { xs: '2 / 4', md: '2 / 6' }, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mt: -0.5 }}>
                      {estado(f)}
                      <Typography variant="caption" color="text.secondary">
                        Leído: “{f.leido}”{f.total != null ? ` · ${fmtARS(f.total)}` : ''}
                      </Typography>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {fase === 'revisar' && (
          <Button onClick={() => { setFase('elegir'); setFilas([]) }} disabled={guardando} sx={{ mr: 'auto' }}>
            Otra imagen
          </Button>
        )}
        <Button onClick={onClose} disabled={guardando}>Cancelar</Button>
        {fase === 'revisar' && (
          <Button variant="contained" onClick={importar} disabled={guardando || seleccionadas.length === 0}>
            {guardando ? 'Guardando…' : `Aceptar ${seleccionadas.length}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
