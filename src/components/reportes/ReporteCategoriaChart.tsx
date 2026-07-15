'use client'

import { useMemo } from 'react'
import ReporteDonutChart, { type DonutSlice } from './ReporteDonutChart'
import type { ReporteCategoria } from '@/lib/types'
import { CATEGORICAL, NEUTRAL_SIN, NEUTRAL_OTRAS } from './vizConfig'

interface Props {
  data: ReporteCategoria[]
}

const MAX_SLICES = 8

// Arma los slices del donut: solo montos positivos (un pie no representa negativos),
// hasta MAX_SLICES; el excedente se agrupa en "Otras". "Sin categoría" y "Otras"
// usan tonos neutros para no impersonar un slot categórico real.
function buildSlices(data: ReporteCategoria[]): DonutSlice[] {
  const positivos = data.filter((c) => c.total_ars > 0)
  const slices: DonutSlice[] = []
  let colorIdx = 0
  const visibles = positivos.length > MAX_SLICES ? positivos.slice(0, MAX_SLICES - 1) : positivos

  for (const c of visibles) {
    const color = c.id === null ? NEUTRAL_SIN : CATEGORICAL[colorIdx++ % CATEGORICAL.length]
    slices.push({ id: c.id === null ? 'sin' : `c${c.id}`, label: c.nombre, value: c.total_ars, color })
  }
  if (positivos.length > MAX_SLICES) {
    const resto = positivos.slice(MAX_SLICES - 1).reduce((s, c) => s + c.total_ars, 0)
    slices.push({ id: 'otras', label: 'Otras', value: Math.round(resto * 100) / 100, color: NEUTRAL_OTRAS })
  }
  return slices
}

export default function ReporteCategoriaChart({ data }: Props) {
  const slices = useMemo(() => buildSlices(data), [data])
  return (
    <ReporteDonutChart
      title="Gasto por categoría"
      subtitle="Cada gasto suma su total completo a todas sus categorías"
      slices={slices}
      emptyText="Sin gastos positivos en el período."
    />
  )
}
