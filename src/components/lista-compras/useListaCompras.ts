'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import type { ArticuloCatalogo, ListaCompraItem, ListaCompraTotales } from '@/lib/types'
import type { SubunidadDe } from '@/lib/lista-compras-compute'

/** Fila de una tabla de catálogo (unidades, rubros). */
export interface OpcionCatalogo {
  id: number
  nombre: string
  /** Cantidad de artículos que la usan (sólo la trae el listado). */
  uso?: number
  /** Sólo en unidades: "kg"/"l" si es la milésima parte de esa base (g, ml). */
  subunidad_de?: SubunidadDe | null
}

/** Una compra puntual: cantidad, precio (por la unidad de la línea; null = sin anotar) y fecha local. */
export interface CompraInput {
  cantidad: number
  precio_unitario: number | null
  fecha: string
}

export interface AltaItem {
  nombre: string
  unidad_id: number
  rubro_id: number | null
  cantidad: number
  /** Si el artículo es nuevo: verlo en kg/l (se cargó en kg/l). */
  mostrar_en_multiplo?: boolean
}

export interface CambioItem {
  cantidad?: number
  precio_unitario?: number | null
  /** Atajo: `true` = llevo todo, `false` = nada. */
  comprado?: boolean
  /** Cuánto llevo comprado en total (acumulado). */
  cantidad_comprada?: number
  unidad_id?: number
  /** null = quitar el rubro. */
  rubro_id?: number | null
  /** Renombra el artículo (en todos los meses). */
  nombre?: string
  /** Preferencia del artículo en g/ml: ver y cargar las cantidades en kg/l. */
  mostrar_en_multiplo?: boolean
}

const TOTALES_VACIOS: ListaCompraTotales = { items: 0, comprados: 0, parciales: 0, excedidos: 0, pendientes: 0, gastado: 0, estimado: 0, sin_precio: 0 }

/** Estado + ABM de la lista de compras de un mes y del catálogo para autocompletar. */
export function useListaCompras(mes: number, anio: number) {
  const [items, setItems] = useState<ListaCompraItem[]>([])
  const [totales, setTotales] = useState<ListaCompraTotales>(TOTALES_VACIOS)
  const [catalogo, setCatalogo] = useState<ArticuloCatalogo[]>([])
  const [unidades, setUnidades] = useState<OpcionCatalogo[]>([])
  const [rubros, setRubros] = useState<OpcionCatalogo[]>([])
  const [loading, setLoading] = useState(true)

  const loadCatalogo = useCallback(async () => {
    try {
      const res = await fetch('/api/lista-compras/articulos', { cache: 'no-store' })
      if (res.ok) setCatalogo(await res.json())
    } catch {
      setCatalogo([])
    }
  }, [])

  const loadOpciones = useCallback(async () => {
    try {
      const [u, r] = await Promise.all([
        fetch('/api/lista-compras/unidades', { cache: 'no-store' }),
        fetch('/api/lista-compras/rubros', { cache: 'no-store' }),
      ])
      if (u.ok) setUnidades(await u.json())
      if (r.ok) setRubros(await r.json())
    } catch {
      toast.error('Error al cargar las unidades y rubros')
    }
  }, [])

  /** Agrega una fila a la tabla de unidades/rubros (o devuelve la que ya existía con ese nombre). */
  const crearOpcion = useCallback(
    (tipo: 'unidades' | 'rubros') => async (nombre: string): Promise<OpcionCatalogo | null> => {
      try {
        const res = await fetch(`/api/lista-compras/${tipo}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre }),
        })
        if (!res.ok) throw new Error()
        const creada: OpcionCatalogo = await res.json()
        const set = tipo === 'unidades' ? setUnidades : setRubros
        set((prev) =>
          prev.some((o) => o.id === creada.id)
            ? prev
            : [...prev, creada].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
        )
        return creada
      } catch {
        toast.error(tipo === 'unidades' ? 'Error al agregar la unidad' : 'Error al agregar el rubro')
        return null
      }
    },
    [],
  )

  const renombrarOpcion = useCallback(async (tipo: 'unidades' | 'rubros', id: number, nombre: string) => {
    try {
      const res = await fetch(`/api/lista-compras/${tipo}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Error al renombrar')
        return false
      }
      // El nombre se ve en las filas de la lista y en el catálogo: se recargan los tres.
      await Promise.all([loadOpciones(), loadCatalogo(), loadRef.current()])
      return true
    } catch {
      toast.error('Error al renombrar')
      return false
    }
  }, [loadOpciones, loadCatalogo])

  /** Fija o quita la equivalencia de una unidad (g → kg, ml → l). */
  const fijarSubunidad = useCallback(async (id: number, subunidad_de: SubunidadDe | null) => {
    try {
      const res = await fetch(`/api/lista-compras/unidades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subunidad_de }),
      })
      if (!res.ok) throw new Error()
      // Cambia cómo se muestra y se carga el precio de las filas con esa unidad.
      await Promise.all([loadOpciones(), loadRef.current()])
      return true
    } catch {
      toast.error('Error al guardar la equivalencia')
      return false
    }
  }, [loadOpciones])

  const borrarOpcion = useCallback(async (tipo: 'unidades' | 'rubros', id: number) => {
    try {
      const res = await fetch(`/api/lista-compras/${tipo}/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Error al borrar')
        await loadOpciones() // el "uso" que se mostraba estaba desactualizado
        return false
      }
      await loadOpciones()
      return true
    } catch {
      toast.error('Error al borrar')
      return false
    }
  }, [loadOpciones])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/lista-compras?mes=${mes}&anio=${anio}`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setItems(data.items)
      setTotales(data.totales)
    } catch {
      toast.error('Error al cargar la lista de compras')
    } finally {
      setLoading(false)
    }
  }, [mes, anio])

  // `renombrarOpcion` se declara antes que `load`; accede a la última versión por ref.
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => { load() }, [load])
  useEffect(() => { loadCatalogo() }, [loadCatalogo])
  useEffect(() => { loadOpciones() }, [loadOpciones])

  /** Da de alta la línea y devuelve la creada (`null` si falló). `recargar: false` en altas en tanda. */
  const agregar = useCallback(async (input: AltaItem, recargar = true): Promise<ListaCompraItem | null> => {
    try {
      const res = await fetch('/api/lista-compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, mes, anio }),
      })
      if (res.status === 409) {
        toast.error(`"${input.nombre}" ya está en la lista de este mes`)
        return null
      }
      if (!res.ok) throw new Error()
      const creada: ListaCompraItem = await res.json()
      if (recargar) await Promise.all([load(), loadCatalogo()])
      return creada
    } catch {
      toast.error(`Error al agregar "${input.nombre}"`)
      return null
    }
  }, [mes, anio, load, loadCatalogo])

  /** Recarga la lista y el catálogo (al terminar un alta en tanda). */
  const recargarTodo = useCallback(() => Promise.all([load(), loadCatalogo()]).then(() => undefined), [load, loadCatalogo])

  const cambiar = useCallback(async (id: number, cambio: CambioItem) => {
    try {
      const res = await fetch(`/api/lista-compras/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambio),
      })
      if (!res.ok) {
        // 409 trae el motivo (nombre repetido, línea con compras): se muestra tal cual.
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Error al guardar el cambio')
        return false
      }
      await Promise.all([load(), loadCatalogo()])
      return true
    } catch {
      toast.error('Error al guardar el cambio')
      return false
    }
  }, [load, loadCatalogo])

  const eliminar = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/lista-compras/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await load()
      return true
    } catch {
      toast.error('Error al quitar el artículo')
      return false
    }
  }, [load])

  /** Alta/edición/baja de una compra: el server recalcula lo llevado y el promedio, así que se recarga todo. */
  const guardarCompra = useCallback(async (itemId: number, input: CompraInput, compraId?: number, recargar = true) => {
    try {
      const res = await fetch(`/api/lista-compras/${itemId}/compras${compraId ? `/${compraId}` : ''}`, {
        method: compraId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error()
      if (recargar) {
        toast.success(compraId ? 'Compra actualizada' : 'Compra registrada')
        await Promise.all([load(), loadCatalogo()])
      }
      return true
    } catch {
      toast.error('Error al guardar la compra')
      return false
    }
  }, [load, loadCatalogo])

  const borrarCompra = useCallback(async (itemId: number, compraId: number) => {
    try {
      const res = await fetch(`/api/lista-compras/${itemId}/compras/${compraId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await Promise.all([load(), loadCatalogo()])
      return true
    } catch {
      toast.error('Error al borrar la compra')
      return false
    }
  }, [load, loadCatalogo])

  const copiarDelMesAnterior = useCallback(async () => {
    try {
      const res = await fetch('/api/lista-compras/copiar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, anio }),
      })
      if (res.status === 404) {
        toast.error('No hay una lista anterior para copiar')
        return false
      }
      if (!res.ok) throw new Error()
      const r = await res.json()
      toast.success(
        r.copiados === 0
          ? 'No había nada nuevo para copiar'
          : `${r.copiados} artículo(s) copiados de ${String(r.origen.mes).padStart(2, '0')}/${r.origen.anio}`,
      )
      await load()
      return true
    } catch {
      toast.error('Error al copiar la lista')
      return false
    }
  }, [mes, anio, load])

  return {
    unidades,
    rubros,
    crearUnidad: crearOpcion('unidades'),
    crearRubro: crearOpcion('rubros'),
    recargarOpciones: loadOpciones,
    renombrarOpcion,
    borrarOpcion,
    fijarSubunidad,
    guardarCompra,
    borrarCompra,
    items, totales, catalogo, loading, agregar, recargarTodo, cambiar, eliminar, copiarDelMesAnterior }
}
