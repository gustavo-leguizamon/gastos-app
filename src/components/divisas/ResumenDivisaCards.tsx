'use client'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import LinearProgress from '@mui/material/LinearProgress'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { ResumenDivisa } from '@/lib/divisas-compute'
import { colorResultado, fmtArs, fmtConSigno, fmtDivisa, fmtPct } from './formato'

interface Props {
  resumen: ResumenDivisa
  /** Símbolo de la divisa (`US$`, `€`). */
  simbolo: string
}

/**
 * El estado de la posición en ocho tiles, en dos bloques: **la posición** (qué tengo, qué me
 * costó, qué vale) y **el resultado** (lo que ya realicé, lo que está latente y el total).
 *
 * La separación entre realizado y no realizado es la que evita el autoengaño: sin ella, una
 * ganancia que todavía depende de la cotización de mañana se lee igual que unos pesos que ya
 * están en la cuenta.
 */
export default function ResumenDivisaCards({ resumen, simbolo }: Props) {
  const {
    tenencia,
    tenencia_comprada,
    tenencia_ganada,
    ganada_pct,
    costo_total,
    costo_promedio,
    valor_actual,
    cotizacion_actual,
    resultado_no_realizado,
    resultado_realizado,
    resultado_total,
    comision_ars,
    comision_divisa,
  } = resumen

  const tiles: {
    label: string
    value: string
    caption?: string
    color?: string
    tip: string
    barra?: number
  }[] = [
    {
      label: 'Tenencia',
      value: fmtDivisa(tenencia, simbolo),
      caption:
        tenencia > 0
          ? `${fmtDivisa(tenencia_comprada, simbolo)} comprados · ${fmtDivisa(tenencia_ganada, simbolo)} ganados`
          : undefined,
      color: 'primary.main',
      tip: 'Divisa en mano. Los "ganados" entraron por rendimientos: no costaron pesos, y por eso bajan el costo promedio',
      barra: ganada_pct ?? undefined,
    },
    {
      label: 'Costo promedio',
      value: costo_promedio === null ? '—' : fmtArs(costo_promedio),
      caption: ganada_pct === null ? undefined : `${fmtPct(ganada_pct).replace('+', '')} ganado`,
      tip: 'A cuánto salió en promedio cada unidad que todavía tenés, comisiones incluidas',
    },
    {
      label: 'Costo total',
      value: fmtArs(costo_total),
      tip: 'Pesos que siguen inmovilizados en la tenencia actual (promedio ponderado)',
    },
    {
      label: 'Valor hoy',
      value: valor_actual === null ? '—' : fmtArs(valor_actual),
      caption: cotizacion_actual === null ? 'Cargá una cotización' : `a ${fmtArs(cotizacion_actual)}`,
      tip: 'Cuántos pesos son hoy esos dólares, según la última cotización cargada',
    },
    {
      label: 'Sin realizar',
      value: resultado_no_realizado === null ? '—' : fmtConSigno(resultado_no_realizado, fmtArs),
      caption: resultado_no_realizado === null ? undefined : fmtPct(resumen.resultado_pct),
      color: colorResultado(resultado_no_realizado),
      tip: 'Lo que ganarías (o perderías) si vendieras todo hoy. Todavía depende de la cotización',
    },
    {
      label: 'Realizado',
      value: fmtConSigno(resultado_realizado, fmtArs),
      color: colorResultado(resultado_realizado),
      tip: 'Resultado de las operaciones ya cerradas: pesos obtenidos menos el costo de la divisa entregada',
    },
    {
      label: 'Resultado total',
      value: resultado_total === null ? '—' : fmtConSigno(resultado_total, fmtArs),
      color: colorResultado(resultado_total),
      tip: 'Realizado + sin realizar: cómo viene toda la operatoria',
    },
    {
      label: 'Comisiones',
      value: fmtArs(comision_ars),
      caption: comision_divisa > 0 ? `+ ${fmtDivisa(comision_divisa, simbolo)}` : undefined,
      tip: 'Lo que se llevó el intermediario. Las cobradas en divisa van aparte: sumarlas sería sumar peras con manzanas',
    },
  ]

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        gap: { xs: 1.5, sm: 2 },
        mb: { xs: 2, sm: 3 },
      }}
    >
      {tiles.map((t) => (
        <Tooltip key={t.label} title={t.tip}>
          <Card variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              {t.label}
            </Typography>
            <Typography variant="h6" fontWeight={700} sx={{ color: t.color, lineHeight: 1.2, fontSize: { xs: 16, sm: 20 } }}>
              {t.value}
            </Typography>
            {t.barra !== undefined && (
              <LinearProgress
                variant="determinate"
                value={Math.min(Math.max(t.barra, 0), 100)}
                color="success"
                sx={{ mt: 0.75, height: 4, borderRadius: 2 }}
              />
            )}
            {t.caption && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontSize: 11 }}>
                {t.caption}
              </Typography>
            )}
          </Card>
        </Tooltip>
      ))}
    </Box>
  )
}
