'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { sumMontosArs } from '@/lib/ingresos-compute'
import type { Ingreso } from '@/lib/types'

export interface IngresoInput {
  fecha: string
  /** Monto en la moneda elegida; se lleva a ARS con `tipo_cambio`. */
  monto_moneda: number
  moneda_id: number
  /** Siempre 1 cuando la moneda es ARS. */
  tipo_cambio: number
  descripcion: string
  casa_id: number | null
  /** Mes/año al que se imputa. Siempre el que se está mirando, aunque la fecha caiga afuera. */
  mes: number
  anio: number
}

/**
 * Estado + ABM de los ingresos de un mes. Lo comparten la página `/ingresos` y el
 * `IngresosDialog` del dashboard para que ambos hablen con la misma API y calculen el total
 * con la misma función que el resumen (`sumIngresos`).
 */
export function useIngresos(mes: number, anio: number, casaId: number | null) {
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        mes: String(mes),
        anio: String(anio),
        ...(casaId ? { casa_id: String(casaId) } : {}),
      })
      const res = await fetch(`/api/ingresos?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      setIngresos(await res.json())
    } catch {
      toast.error('Error al cargar los ingresos')
    } finally {
      setLoading(false)
    }
  }, [mes, anio, casaId])

  useEffect(() => { load() }, [load])

  const guardar = useCallback(async (input: IngresoInput, id?: number) => {
    setSaving(true)
    try {
      const res = await fetch(id ? `/api/ingresos/${id}` : '/api/ingresos', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error()
      toast.success(id ? 'Ingreso actualizado' : 'Ingreso agregado')
      await load()
      return true
    } catch {
      toast.error('Error al guardar el ingreso')
      return false
    } finally {
      setSaving(false)
    }
  }, [load])

  const eliminar = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/ingresos/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Ingreso eliminado')
      await load()
      return true
    } catch {
      toast.error('Error al eliminar el ingreso')
      return false
    }
  }, [load])

  return { ingresos, total: sumMontosArs(ingresos), loading, saving, reload: load, guardar, eliminar }
}
