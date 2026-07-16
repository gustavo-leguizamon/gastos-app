'use client'

import { useMemo } from 'react'
import ReporteRankingChart from './ReporteRankingChart'
import type { ReporteCategoria } from '@/lib/types'
import { CATEGORICAL } from './vizConfig'

interface Props {
  data: ReporteCategoria[]
}

export default function ReporteEtiquetaChart({ data }: Props) {
  const items = useMemo(() => data.map((e) => ({ label: e.nombre, total_ars: e.total_ars })), [data])
  return (
    <ReporteRankingChart
      title="Por etiqueta"
      subtitle="Cobertura: un gasto puede sumar a varias etiquetas (los montos pueden superar el total)"
      data={items}
      color={CATEGORICAL[4]}
      emptyText="Sin etiquetas en el período."
    />
  )
}
