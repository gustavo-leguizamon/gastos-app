'use client'

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import toast from 'react-hot-toast'
import TextField from '@/components/shared/AppTextField'
import AppDateField from '@/components/shared/AppDateField'
import { entradaDePrecio, precioUnitarioDeEntrada, type ModoPrecio } from '@/lib/lista-compras-compute'
import type { ListaCompraCompra, ListaCompraItem } from '@/lib/types'
import CampoPrecio from './CampoPrecio'
import { fmtARS, hoyLocal, parseNum } from './formato'
import type { CompraInput } from './useListaCompras'

interface Props {
  open: boolean
  /** Línea a la que se le registra la compra. */
  item: ListaCompraItem | null
  /** Compra en edición, o `null` para registrar una nueva. */
  compra: ListaCompraCompra | null
  onClose: () => void
  onGuardar: (itemId: number, input: CompraInput, compraId?: number) => Promise<boolean>
}

/**
 * Registrar o editar una compra de una línea: cuánto se compró, a qué precio y cuándo. Al alta se
 * ofrece lo que falta para completar y el último precio conocido (promedio actual o, si no hay,
 * el de la referencia). El precio se puede cargar **unitario** (por kg/litro si la unidad es g/ml)
 * o como **total pagado**, y se calcula el otro: 500 g por $2.000 → $4.000 por kg. Con unidad g/ml
 * arranca en "total pagado" (es lo que dice el ticket); con las demás, en unitario.
 */
export default function CompraDialog({ open, item, compra, onClose, onGuardar }: Props) {
  const [cantidad, setCantidad] = useState('')
  const [precio, setPrecio] = useState('')
  const [modo, setModo] = useState<ModoPrecio>('unitario')
  const [fecha, setFecha] = useState(hoyLocal())
  const [guardando, setGuardando] = useState(false)
  const base = item?.subunidad_de ?? null

  useEffect(() => {
    if (!open || !item) return
    const modoInicial: ModoPrecio = base ? 'total' : 'unitario'
    const cant = compra ? compra.cantidad : item.faltante > 0 ? item.faltante : item.cantidad
    const precioInicial = compra ? compra.precio_unitario : item.precio_unitario ?? item.referencia?.precio_unitario ?? null
    const entrada = precioInicial == null ? null : entradaDePrecio(modoInicial, precioInicial, cant, base)
    setModo(modoInicial)
    setCantidad(String(cant))
    setPrecio(entrada == null ? '' : String(entrada))
    setFecha(compra ? compra.fecha : hoyLocal())
    // Sólo al abrir o cambiar de línea/compra: si la lista se recarga con el diálogo abierto, no pisa lo tipeado.
  }, [open, item?.id, compra?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null

  /** Al cambiar entre unitario y total, el campo se convierte (no queda un número con otro significado). */
  const cambiarModo = (nuevo: ModoPrecio) => {
    const c = parseNum(cantidad)
    const p = parseNum(precio)
    if (p != null && Number.isFinite(p) && p >= 0) {
      const unitario = precioUnitarioDeEntrada(modo, p, c != null && Number.isFinite(c) ? c : null, base)
      const entrada = unitario == null ? null : entradaDePrecio(nuevo, unitario, c != null && Number.isFinite(c) ? c : null, base)
      if (entrada != null) setPrecio(String(entrada))
    }
    setModo(nuevo)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const c = parseNum(cantidad)
    const p = parseNum(precio)
    if (c == null || !Number.isFinite(c) || c <= 0) return toast.error('La cantidad tiene que ser mayor a 0')
    if (p !== null && (!Number.isFinite(p) || p < 0)) return toast.error('El precio no es válido')
    if (!fecha) return toast.error('Completá la fecha')
    setGuardando(true)
    const ok = await onGuardar(
      item.id,
      { cantidad: c, precio_unitario: p == null ? null : precioUnitarioDeEntrada(modo, p, c, base), fecha },
      compra?.id,
    )
    setGuardando(false)
    if (ok) onClose()
  }

  const c = parseNum(cantidad)
  const p = parseNum(precio)
  const cantidadValida = c != null && Number.isFinite(c) ? c : null
  const unitario = p != null && Number.isFinite(p) ? precioUnitarioDeEntrada(modo, p, cantidadValida, base) : null
  const importe = cantidadValida != null && unitario != null ? cantidadValida * unitario : null

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle fontWeight={700}>
          {compra ? 'Editar compra' : 'Registrar compra'} · {item.nombre}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <TextField
            label={`Cantidad (${item.unidad})`}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            inputProps={{ inputMode: 'decimal' }}
            autoFocus
            helperText={!compra && item.faltante > 0 ? `Faltan ${item.faltante.toLocaleString('es-AR', { maximumFractionDigits: 3 })} ${item.unidad}` : undefined}
          />
          <CampoPrecio
            modo={modo}
            onModo={cambiarModo}
            value={precio}
            onChange={setPrecio}
            base={base}
            unidad={item.unidad}
            cantidad={cantidadValida}
            size="medium"
            opcional
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
            Sin precio, la compra suma cantidad pero no entra al promedio.
          </Typography>
          <AppDateField label="Fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          {importe != null && (
            <Typography variant="body2" color="text.secondary">Importe de esta compra: <b>{fmtARS(importe)}</b></Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={guardando}>{compra ? 'Guardar' : 'Registrar'}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
