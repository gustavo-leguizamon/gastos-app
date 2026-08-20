'use client'

import { useMemo } from 'react'
import ReporteRankingChart from './ReporteRankingChart'
import type { ReporteCasa } from '@/lib/types'
import { CATEGORICAL } from './vizConfig'

interface Props {
  data: ReporteCasa[]
}

/**
 * Gasto por casa. La casa existía sólo como filtro: se podía mirar una a la vez, pero no
 * comparar cuánto gastó cada una — que es la pregunta obvia cuando hay más de una.
 */
export default function ReporteCasaChart({ data }: Props) {
  const items = useMemo(() => data.map((c) => ({ label: c.nombre, total_ars: c.total_ars })), [data])
  return (
    <ReporteRankingChart
      title="Gasto por casa"
      subtitle="Partición: cada gasto cuenta en una sola casa"
      data={items}
      color={CATEGORICAL[4]}
    />
  )
}
