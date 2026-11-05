'use client'

import { useState } from 'react'
import type { SubunidadDe } from '@/lib/lista-compras-compute'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import TextField from '@/components/shared/AppTextField'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import type { OpcionCatalogo } from './useListaCompras'

type Tipo = 'unidades' | 'rubros'

interface Props {
  open: boolean
  unidades: OpcionCatalogo[]
  rubros: OpcionCatalogo[]
  onClose: () => void
  onRenombrar: (tipo: Tipo, id: number, nombre: string) => Promise<boolean>
  onBorrar: (tipo: Tipo, id: number) => Promise<boolean>
  onFijarSubunidad: (id: number, subunidad: SubunidadDe | null) => Promise<boolean>
}

function Seccion({
  titulo,
  tipo,
  opciones,
  onRenombrar,
  onPedirBorrar,
  onFijarSubunidad,
}: {
  titulo: string
  tipo: Tipo
  opciones: OpcionCatalogo[]
  onRenombrar: Props['onRenombrar']
  onPedirBorrar: (tipo: Tipo, o: OpcionCatalogo) => void
  onFijarSubunidad: Props['onFijarSubunidad']
}) {
  const [editando, setEditando] = useState<number | null>(null)
  const [texto, setTexto] = useState('')

  const guardar = async (o: OpcionCatalogo) => {
    const nuevo = texto.trim()
    if (!nuevo || nuevo === o.nombre) return setEditando(null)
    // Si falla (nombre repetido) queda en edición para corregirlo.
    if (await onRenombrar(tipo, o.id, nuevo)) setEditando(null)
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>{titulo}</Typography>
      {opciones.length === 0 && <Typography variant="body2" color="text.secondary">No hay ninguno cargado.</Typography>}
      {opciones.map((o) => {
        const uso = o.uso ?? 0
        return (
          <Box key={o.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, flexWrap: 'wrap', borderBottom: '1px solid', borderColor: 'divider' }}>
            {editando === o.id ? (
              <>
                <TextField
                  size="small"
                  autoFocus
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') guardar(o)
                    if (e.key === 'Escape') setEditando(null)
                  }}
                  sx={{ flex: 1 }}
                />
                <IconButton size="small" onClick={() => guardar(o)} aria-label="Guardar"><CheckIcon fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => setEditando(null)} aria-label="Cancelar"><CloseIcon fontSize="small" /></IconButton>
              </>
            ) : (
              <>
                <Typography variant="body2" sx={{ flex: '1 1 120px', wordBreak: 'break-word' }}>{o.nombre}</Typography>
                {tipo === 'unidades' && (
                  <Tooltip title="Si es la milésima parte de kg, litro o metro, el precio se carga y se compara por kg/litro/metro">
                    <TextField
                      select
                      size="small"
                      label="Equivale a 1/1000 de"
                      value={o.subunidad_de ?? ''}
                      onChange={(e) => onFijarSubunidad(o.id, (e.target.value || null) as SubunidadDe | null)}
                      sx={{ width: { xs: '100%', sm: 170 }, order: { xs: 5, sm: 0 } }}
                    >
                      <MenuItem value="">— (nada)</MenuItem>
                      <MenuItem value="kg">kg (ej: gramos)</MenuItem>
                      <MenuItem value="l">litro (ej: ml)</MenuItem>
                      <MenuItem value="m">metro (ej: mm)</MenuItem>
                    </TextField>
                  </Tooltip>
                )}
                <Typography variant="caption" color="text.secondary">
                  {uso === 0 ? 'sin uso' : `${uso} artículo${uso === 1 ? '' : 's'}`}
                </Typography>
                <Tooltip title="Renombrar">
                  <IconButton size="small" onClick={() => { setEditando(o.id); setTexto(o.nombre) }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={uso > 0 ? 'No se puede borrar: está en uso' : 'Borrar'}>
                  {/* span: un botón deshabilitado no dispara el tooltip. */}
                  <span>
                    <IconButton size="small" disabled={uso > 0} onClick={() => onPedirBorrar(tipo, o)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

/** Renombrar y borrar unidades y rubros. Sólo se borra lo que ningún artículo usa. */
export default function CatalogoAdminDialog({ open, unidades, rubros, onClose, onRenombrar, onBorrar, onFijarSubunidad }: Props) {
  const [aBorrar, setABorrar] = useState<{ tipo: Tipo; fila: OpcionCatalogo } | null>(null)
  // En el celular un diálogo chico queda apretado y con el teclado tapa todo: pantalla completa.
  const pantallaCompleta = useMediaQuery(useTheme().breakpoints.down('sm'))

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={pantallaCompleta}>
        <DialogTitle fontWeight={700}>Unidades y rubros</DialogTitle>
        <DialogContent>
          <Seccion titulo="Unidades" tipo="unidades" opciones={unidades} onRenombrar={onRenombrar} onFijarSubunidad={onFijarSubunidad} onPedirBorrar={(tipo, fila) => setABorrar({ tipo, fila })} />
          <Seccion titulo="Rubros" tipo="rubros" opciones={rubros} onRenombrar={onRenombrar} onFijarSubunidad={onFijarSubunidad} onPedirBorrar={(tipo, fila) => setABorrar({ tipo, fila })} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!aBorrar}
        title={aBorrar?.tipo === 'unidades' ? 'Borrar unidad' : 'Borrar rubro'}
        message={aBorrar ? `¿Borrar "${aBorrar.fila.nombre}"?` : ''}
        onConfirm={async () => {
          if (aBorrar) await onBorrar(aBorrar.tipo, aBorrar.fila.id)
          setABorrar(null)
        }}
        onCancel={() => setABorrar(null)}
      />
    </>
  )
}
