// Qué columnas se exportan de cada cosa. Vive aparte de `csv.ts` (el serializador genérico)
// y de los componentes, para poder testear el mapeo sin montar React.

import { toCsv, type CsvColumn } from './csv'
import type { Gasto, Reporte } from './types'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/**
 * Columnas de la exportación de gastos. Incluye los computados (`total_ars`, `total_pagado`,
 * `total_restante`) porque son el dato que interesa afuera y no se pueden recalcular desde
 * el CSV: el pagado sale de la tabla `Pago`, no de una columna del gasto.
 */
export const COLUMNAS_GASTOS: CsvColumn<Gasto>[] = [
  { header: 'Mes', value: g => MESES[g.mes - 1] ?? String(g.mes) },
  { header: 'Año', value: g => g.anio },
  { header: 'Vencimiento', value: g => g.fecha_vencimiento },
  { header: 'Descripción', value: g => g.descripcion },
  { header: 'Casa', value: g => g.casa_nombre ?? '' },
  { header: 'Categoría', value: g => g.categoria?.nombre ?? '' },
  { header: 'Etiquetas', value: g => (g.etiquetas ?? []).map(e => e.nombre).join(', ') },
  { header: 'Tipo de pago', value: g => (g.tipo_pago === 'C' ? 'Crédito' : 'Débito') },
  { header: 'Tarjeta', value: g => g.tarjeta_nombre ?? '' },
  { header: 'Moneda', value: g => g.moneda_codigo ?? '' },
  { header: 'Monto', value: g => g.total_moneda },
  { header: 'Tipo de cambio', value: g => g.tipo_cambio },
  { header: 'Total ARS', value: g => g.total_ars },
  { header: 'Pagado', value: g => g.total_pagado },
  { header: 'Restante', value: g => g.total_restante },
  { header: 'Cuota', value: g => (g.cuota_actual != null ? `${g.cuota_actual}/${g.cuotas_totales ?? '?'}` : '') },
  { header: 'Confirmado', value: g => g.confirmado },
  { header: 'Resumen de tarjeta', value: g => g.es_tarjeta },
  { header: 'Notas', value: g => g.notas ?? '' },
  { header: 'Sub-ítems', value: g => (g.items ?? []).length },
]

/** Una fila por sub-ítem, con el gasto padre como contexto. */
export interface FilaSubitem {
  gasto: Gasto
  item: Gasto['items'][number]
}

export const COLUMNAS_SUBITEMS: CsvColumn<FilaSubitem>[] = [
  { header: 'Mes', value: f => MESES[f.gasto.mes - 1] ?? String(f.gasto.mes) },
  { header: 'Año', value: f => f.gasto.anio },
  { header: 'Gasto', value: f => f.gasto.descripcion },
  { header: 'Casa', value: f => f.gasto.casa_nombre ?? '' },
  { header: 'Tarjeta', value: f => f.gasto.tarjeta_nombre ?? '' },
  { header: 'Sub-ítem', value: f => f.item.descripcion },
  { header: 'Fecha', value: f => f.item.fecha ?? '' },
  { header: 'Monto', value: f => f.item.monto },
  { header: 'Categoría', value: f => f.item.categoria?.nombre ?? '' },
  { header: 'Etiquetas', value: f => (f.item.etiquetas ?? []).map(e => e.nombre).join(', ') },
  { header: 'Cuota', value: f => (f.item.cuota_actual != null ? `${f.item.cuota_actual}/${f.item.cuotas_totales ?? '?'}` : '') },
  { header: 'Suma al total', value: f => f.item.incluye_en_total },
  { header: 'Vence', value: f => f.item.incluye_en_vencimiento },
  { header: 'Verificado', value: f => f.item.verificado },
]

/** Aplana los gastos a una fila por sub-ítem. Los gastos sin sub-ítems no aportan filas. */
export function aplanarSubitems(gastos: Gasto[]): FilaSubitem[] {
  return (gastos ?? []).flatMap(gasto => (gasto.items ?? []).map(item => ({ gasto, item })))
}

export function gastosACsv(gastos: Gasto[]): string {
  return toCsv(gastos ?? [], COLUMNAS_GASTOS)
}

export function subitemsACsv(gastos: Gasto[]): string {
  return toCsv(aplanarSubitems(gastos), COLUMNAS_SUBITEMS)
}

/**
 * El reporte a CSV. Como tiene varias dimensiones de distinta forma, se emite **una tabla
 * por dimensión** separada por una línea en blanco, con un título arriba. Es lo que hace
 * legible el archivo en Excel; un CSV "normalizado" con una fila por (dimensión, valor)
 * sería más puro pero mucho menos útil para pegar en una planilla.
 */
export function reporteACsv(reporte: Reporte): string {
  const bloques: string[] = []

  const bloque = <T,>(titulo: string, filas: T[], cols: CsvColumn<T>[]) => {
    if (!filas.length) return
    bloques.push(titulo + '\r\n' + toCsv(filas, cols).replace(/^﻿/, ''))
  }

  bloques.push(
    'KPIs\r\n' +
      toCsv(
        [reporte.kpis],
        [
          { header: 'Total', value: k => k.total },
          { header: 'Promedio mensual', value: k => k.promedio_mensual },
          { header: 'Cantidad de gastos', value: k => k.cantidad_gastos },
          { header: 'Meses', value: k => k.meses },
          { header: 'Total período anterior', value: k => k.total_previo },
          { header: 'Variación %', value: k => k.variacion_pct },
        ],
      ).replace(/^﻿/, ''),
  )

  const totalCols = <T extends { nombre: string; total_ars: number }>(): CsvColumn<T>[] => [
    { header: 'Nombre', value: r => r.nombre },
    { header: 'Total ARS', value: r => r.total_ars },
  ]

  bloque('Por categoría', reporte.por_categoria, totalCols())
  bloque('Por etiqueta', reporte.por_etiqueta, totalCols())
  bloque('Por casa', reporte.por_casa, totalCols())
  bloque('Por tarjeta', reporte.por_tarjeta, totalCols())
  bloque('Por tipo de pago', reporte.por_tipo_pago, totalCols())
  bloque('Por mes', reporte.por_mes, [
    { header: 'Período', value: r => r.label },
    { header: 'Total ARS', value: r => r.total_ars },
  ])
  bloque('Top conceptos', reporte.top_conceptos, totalCols())

  // El BOM va una sola vez, al principio del archivo entero.
  return '﻿' + bloques.join('\r\n')
}
