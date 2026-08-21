'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import EditIcon from '@mui/icons-material/Edit'
import PushPinIcon from '@mui/icons-material/PushPin'
import BlockIcon from '@mui/icons-material/Block'
import toast from 'react-hot-toast'
import AppMultiSelect from '@/components/shared/AppMultiSelect'
import {
  etiquetasSugeridas, reglasDeCategoria, origenEtiqueta,
  type SugerenciasEtiquetas, type ReglaEtiqueta,
} from '@/lib/etiquetas-sugeridas'
import type { Categoria, Etiqueta } from '@/lib/types'

/**
 * Vista y mantenimiento de qué etiquetas ofrece el form para cada categoría.
 *
 * La tabla **no** es una tabla de relaciones guardadas: la mayoría de los pares que muestra no
 * existen en ninguna fila de la base. La lista base se deriva del histórico de uso
 * (`src/lib/etiquetas-sugeridas.ts`) y lo único que se persiste son las excepciones
 * (`CategoriaEtiquetaRegla`): fijar una etiqueta que el histórico todavía no respalda, o excluir
 * una que respalda de más. Por eso cada chip muestra **de dónde sale**, y no sólo que está.
 */

interface Props {
  categorias: Categoria[]
  etiquetas: Etiqueta[]
}

interface Edicion {
  categoria: Categoria
  fijar: number[]
  excluir: number[]
}

export default function EtiquetasPorCategoria({ categorias, etiquetas }: Props) {
  const [sugerencias, setSugerencias] = useState<SugerenciasEtiquetas | null>(null)
  // Sin esto no se distingue "todavía no cargó" de "no hay nada que sugerir": las dos dejan
  // `sugerencias` en null y la tabla diría que se ofrecen todas cuando en realidad no sabe.
  const [cargado, setCargado] = useState(false)
  const [editando, setEditando] = useState<Edicion | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/etiquetas/sugeridas')
      setSugerencias(await res.json())
    } catch { setSugerencias(null) }
    finally { setCargado(true) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const nombrePorId = useMemo(
    () => new Map(etiquetas.map(e => [e.id, e.nombre] as const)),
    [etiquetas],
  )
  const nombreDe = (id: number) => nombrePorId.get(id) ?? `#${id}`

  const opcionesEtiquetas = useMemo(
    () => etiquetas.map(e => ({ value: e.id, label: e.nombre })),
    [etiquetas],
  )

  const abrir = (categoria: Categoria) => {
    const { fijar, excluir } = reglasDeCategoria(sugerencias, categoria.id)
    setEditando({ categoria, fijar, excluir })
  }

  const guardar = async () => {
    if (!editando) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/categorias/${editando.categoria.id}/etiquetas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fijar: editando.fijar, excluir: editando.excluir }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error ?? 'Error al guardar'); return }
      setEditando(null)
      await cargar()
      toast.success('Etiquetas de la categoría actualizadas')
    } catch { toast.error('Error al guardar') }
    finally { setGuardando(false) }
  }

  /**
   * Cómo quedaría la lista con las reglas que se están editando, sin guardar todavía: se
   * reemplazan las reglas de esta categoría por las del diálogo y se recalcula con la misma
   * función que usa el form. Así lo que se ve en el preview es literalmente lo que va a pasar.
   */
  const previewSugeridas = (edicion: Edicion): number[] => {
    const otras = (sugerencias?.reglas ?? []).filter(r => r.categoria_id !== edicion.categoria.id)
    const propias: ReglaEtiqueta[] = [
      ...edicion.fijar.map(id => ({ categoria_id: edicion.categoria.id, etiqueta_id: id, modo: 'fijar' as const })),
      ...edicion.excluir.map(id => ({ categoria_id: edicion.categoria.id, etiqueta_id: id, modo: 'excluir' as const })),
    ]
    const base: SugerenciasEtiquetas = {
      transversales: sugerencias?.transversales ?? [],
      por_categoria: sugerencias?.por_categoria ?? {},
      reglas: [...otras, ...propias],
    }
    return etiquetasSugeridas(base, edicion.categoria.id) ?? []
  }

  const chipDe = (categoriaId: number, etiquetaId: number) => {
    const origen = origenEtiqueta(sugerencias, categoriaId, etiquetaId)
    if (origen === 'fijada') {
      return (
        <Tooltip key={etiquetaId} title="Fijada a mano en esta categoría">
          <Chip size="small" color="primary" icon={<PushPinIcon />} label={nombreDe(etiquetaId)} />
        </Tooltip>
      )
    }
    if (origen === 'transversal') {
      return (
        <Tooltip key={etiquetaId} title="Transversal: se usa en varias categorías, se ofrece en todas">
          <Chip size="small" variant="outlined" label={nombreDe(etiquetaId)} sx={{ opacity: 0.65 }} />
        </Tooltip>
      )
    }
    return (
      <Tooltip key={etiquetaId} title="Ya se usó en esta categoría">
        <Chip size="small" variant="outlined" color="primary" label={nombreDe(etiquetaId)} />
      </Tooltip>
    )
  }

  const totalEtiquetas = etiquetas.length

  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Qué etiquetas ofrece el alta de gastos cuando elegís cada categoría. La lista se calcula
        sola con el histórico de uso — acá sólo se corrige lo que el histórico no acierta.
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2 }}>
        <Chip size="small" variant="outlined" color="primary" label="Ya usada acá" />
        <Chip size="small" variant="outlined" label="Transversal" sx={{ opacity: 0.65 }} />
        <Chip size="small" color="primary" icon={<PushPinIcon />} label="Fijada a mano" />
        <Chip size="small" variant="outlined" color="error" icon={<BlockIcon />} label="Excluida a mano" />
      </Box>

      {!cargado ? (
        <Typography variant="body2" color="text.secondary">Cargando…</Typography>
      ) : (
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Categoría</TableCell>
              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Ofrece</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Etiquetas</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Editar</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {categorias.map(categoria => {
              const sugeridas = etiquetasSugeridas(sugerencias, categoria.id) ?? []
              const { excluir } = reglasDeCategoria(sugerencias, categoria.id)
              return (
                <TableRow key={categoria.id} hover>
                  <TableCell sx={{ fontWeight: 600, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    {categoria.nombre}
                  </TableCell>
                  <TableCell sx={{ verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    <Typography variant="body2" color="text.secondary">
                      {sugeridas.length} de {totalEtiquetas}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {sugeridas.length === 0 && excluir.length === 0 && (
                        <Typography variant="body2" color="text.secondary">
                          Sin datos todavía — se ofrecen todas
                        </Typography>
                      )}
                      {sugeridas.map(id => chipDe(categoria.id, id))}
                      {excluir.map(id => (
                        <Tooltip key={`x-${id}`} title="Excluida a mano: no se ofrece acá">
                          <Chip
                            size="small" variant="outlined" color="error" icon={<BlockIcon />}
                            label={nombreDe(id)} sx={{ textDecoration: 'line-through' }}
                          />
                        </Tooltip>
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ verticalAlign: 'top' }}>
                    <IconButton size="small" onClick={() => abrir(categoria)} aria-label={`Editar etiquetas de ${categoria.nombre}`}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Box>
      )}

      <Dialog open={!!editando} onClose={() => setEditando(null)} maxWidth="sm" fullWidth>
        {editando && (
          <>
            <DialogTitle>Etiquetas de &quot;{editando.categoria.nombre}&quot;</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                La lista base sale del histórico y se actualiza sola: una etiqueta que uses en
                esta categoría queda ofrecida sin tocar nada acá. Usá <b>fijar</b> para adelantarte
                (categoría nueva, sin datos) y <b>excluir</b> para sacar una que el histórico
                ofrece de más.
              </Typography>

              <AppMultiSelect
                label="Fijar siempre"
                options={opcionesEtiquetas}
                value={editando.fijar}
                onChange={(v) => {
                  const fijar = v.map(Number)
                  // Excluir gana sobre fijar, así que no se pueden pedir las dos: la etiqueta que
                  // entra a una lista sale de la otra (el backend rechazaría el par con un 400).
                  setEditando(p => p ? { ...p, fijar, excluir: p.excluir.filter(id => !fijar.includes(id)) } : p)
                }}
                fullWidth
                placeholder="Ninguna"
              />
              <Box sx={{ height: 16 }} />
              <AppMultiSelect
                label="No ofrecer acá"
                options={opcionesEtiquetas}
                value={editando.excluir}
                onChange={(v) => {
                  const excluir = v.map(Number)
                  setEditando(p => p ? { ...p, excluir, fijar: p.fijar.filter(id => !excluir.includes(id)) } : p)
                }}
                fullWidth
                placeholder="Ninguna"
              />

              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.secondary">
                Va a ofrecer {previewSugeridas(editando).length} de {totalEtiquetas} etiquetas:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                {previewSugeridas(editando).map(id => (
                  <Chip key={id} size="small" variant="outlined" label={nombreDe(id)} />
                ))}
                {previewSugeridas(editando).length === 0 && (
                  <Typography variant="body2" color="text.secondary">Ninguna</Typography>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => setEditando(p => p ? { ...p, fijar: [], excluir: [] } : p)}
                disabled={editando.fijar.length === 0 && editando.excluir.length === 0}
              >
                Limpiar reglas
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button onClick={() => setEditando(null)}>Cancelar</Button>
              <Button variant="contained" onClick={guardar} disabled={guardando}>Guardar</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  )
}
