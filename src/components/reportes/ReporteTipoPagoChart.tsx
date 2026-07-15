'use client'

import { useMemo } from 'react'
import ReporteDonutChart, { type DonutSlice } from './ReporteDonutChart'
import type { ReporteTipoPago } from '@/lib/types'
import { CATEGORICAL } from './vizConfig'

interface Props {
  data: ReporteTipoPago[]
}

// Crédito → slot blue, Débito → slot aqua (color estable por tipo, no por ranking).
const COLOR: Record<'C' | 'D', string> = { C: CATEGORICAL[0], D: CATEGORICAL[1] }

export default function ReporteTipoPagoChart({ data }: Props) {
  const slices = useMemo<DonutSlice[]>(
    () => data.filter((d) => d.total_ars > 0).map((d) => ({ id: d.tipo, label: d.nombre, value: d.total_ars, color: COLOR[d.tipo] })),
    [data],
  )
  return (
    <ReporteDonutChart
      title="Por tipo de pago"
      subtitle="Crédito vs. débito"
      slices={slices}
      emptyText="Sin gastos positivos en el período."
    />
  )
}
