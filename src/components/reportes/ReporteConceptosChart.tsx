'use client'

import { useMemo } from 'react'
import ReporteRankingChart from './ReporteRankingChart'
import type { ReporteConcepto } from '@/lib/types'
import { CATEGORICAL } from './vizConfig'

interface Props {
  data: ReporteConcepto[]
}

export default function ReporteConceptosChart({ data }: Props) {
  const items = useMemo(() => data.map((c) => ({ label: c.nombre, total_ars: c.total_ars })), [data])
  return (
    <ReporteRankingChart
      title="Top conceptos"
      subtitle="Conceptos donde más gastaste en el período"
      data={items}
      color={CATEGORICAL[1]}
    />
  )
}
