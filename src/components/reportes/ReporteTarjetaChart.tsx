'use client'

import { useMemo } from 'react'
import ReporteRankingChart from './ReporteRankingChart'
import type { ReporteTarjeta } from '@/lib/types'
import { CATEGORICAL } from './vizConfig'

interface Props {
  data: ReporteTarjeta[]
}

export default function ReporteTarjetaChart({ data }: Props) {
  const items = useMemo(() => data.map((t) => ({ label: t.nombre, total_ars: t.total_ars })), [data])
  return (
    <ReporteRankingChart
      title="Gasto por tarjeta"
      subtitle="Incluye los gastos sin tarjeta (débito / efectivo)"
      data={items}
      color={CATEGORICAL[2]}
    />
  )
}
