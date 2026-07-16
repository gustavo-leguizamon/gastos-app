export interface Moneda {
  id: number
  codigo: string
  nombre: string
  simbolo: string
}

export interface Casa {
  id: number
  nombre: string
}

export type TarjetaMarca = 'visa' | 'mastercard' | 'amex' | 'diners' | 'discover' | 'jcb' | 'otra'

export interface Tarjeta {
  id: number
  nombre: string
  banco: string | null
  marca: TarjetaMarca | null
  cierres?: TarjetaCierre[]
}

export interface TarjetaCierre {
  id: number
  tarjeta_id: number
  mes: number
  anio: number
  fecha_cierre: string | null
  fecha_vencimiento: string | null
  fecha_proximo_cierre: string | null
  created_at: string
  updated_at: string
}

export interface Categoria {
  id: number
  nombre: string
}

// Etiqueta: corte transversal (M2M). Misma forma que Categoria.
export interface Etiqueta {
  id: number
  nombre: string
}

export interface Concepto {
  id: number
  nombre: string
  // Cantidad de gastos + sub-items que lo referencian (sólo en /api/conceptos).
  uso?: number
}

export interface GastoItem {
  id: number
  gasto_id: number
  concepto_id: number
  descripcion: string
  monto: number
  fecha: string | null
  cuota_actual: number | null
  cuotas_totales: number | null
  incluye_en_total: boolean
  incluye_en_vencimiento: boolean
  verificado: boolean
  // Categoría única (partición) + etiquetas (corte transversal).
  categoria_id: number | null
  categoria: Categoria | null
  etiqueta_ids: number[]
  etiquetas: Etiqueta[]
  created_at: string
}

export interface Pago {
  id: number
  gasto_id: number
  fecha: string
  monto: number
  created_at: string
}

export interface Gasto {
  id: number
  casa_id: number
  casa_nombre?: string
  concepto_id: number
  descripcion: string
  fecha_vencimiento: string
  tipo_pago: 'C' | 'D'
  moneda_id: number
  moneda_codigo?: string
  moneda_simbolo?: string
  tipo_cambio: number
  total_moneda: number
  total_ars: number
  total_pagado: number
  total_restante: number
  pasaje_mes_siguiente: number
  prestamo_a_otro: number
  tarjeta_id: number | null
  tarjeta_nombre?: string | null
  tarjeta_banco?: string | null
  tarjeta_marca?: TarjetaMarca | null
  // Categoría única (partición) + etiquetas (corte transversal).
  categoria_id: number | null
  categoria: Categoria | null
  etiqueta_ids: number[]
  etiquetas: Etiqueta[]
  cuota_actual: number | null
  cuotas_totales: number | null
  mes: number
  anio: number
  notas: string | null
  confirmado: boolean
  es_tarjeta: boolean
  cierre?: {
    fecha_cierre: string | null
    fecha_vencimiento: string | null
    fecha_proximo_cierre: string | null
  } | null
  created_at: string
  updated_at: string
  pagos: Pago[]
  items: GastoItem[]
}

export interface GastoFormData {
  fecha_vencimiento: string
  descripcion: string
  casa_id: number
  tipo_pago: 'C' | 'D'
  moneda_id: number
  tipo_cambio: number
  total_moneda: number
  total_pagado: number
  pasaje_mes_siguiente: number
  prestamo_a_otro: number
  tarjeta_id: number | null
  cuota_actual: number | null
  cuotas_totales: number | null
  mes: number
  anio: number
  notas: string
  confirmado: boolean
  categoria_id: number | null
  etiqueta_ids: number[]
  es_tarjeta: boolean
  pagado_completo?: boolean
}

export interface Resumen {
  total_gastos: number
  total_gastos_neto: number
  total_prestamos: number
  total_tarjetas: number
  total_pasajes: number
  total_restante: number
  total_restante_neto: number
  total_pagado: number
  pagar_hoy: number
  total_proximo_mes: number
}

export interface Inversion {
  id: number
  nombre: string
  created_at: string
}

export interface Movimiento {
  id: number
  inversion_id: number
  fecha: string
  monto_actual: number
  movimiento: number
  created_at: string
}

export interface Sueldo {
  id: number
  fecha: string
  sueldo_teorico: number
  sueldo_ars: number
  sueldo_usd: number
  cotizacion_bna: number
  cotizacion_mep: number
  created_at: string
  updated_at: string
}

export interface FiltrosGastos {
  mes: number
  anio: number
  casa_id: number | null
  tipo_pago: 'C' | 'D' | null
}

export interface ReporteCategoria {
  id: number | null
  nombre: string
  total_ars: number
}

export interface ReporteMes {
  mes: number
  anio: number
  label: string
  total_ars: number
}

export interface ReporteConcepto {
  concepto_id: number
  nombre: string
  total_ars: number
}

export interface ReporteTarjeta {
  id: number | null
  nombre: string
  total_ars: number
}

export interface ReporteTipoPago {
  tipo: 'C' | 'D'
  nombre: string
  total_ars: number
}

export interface Reporte {
  kpis: {
    total: number
    promedio_mensual: number
    cantidad_gastos: number
    meses: number
  }
  por_categoria: ReporteCategoria[]
  por_etiqueta: ReporteCategoria[]
  por_mes: ReporteMes[]
  top_conceptos: ReporteConcepto[]
  por_tarjeta: ReporteTarjeta[]
  por_tipo_pago: ReporteTipoPago[]
}

export interface FiltrosReporte {
  mes_desde: number
  anio_desde: number
  mes_hasta: number
  anio_hasta: number
  casa_id: number | null
  tipo_pago: 'C' | 'D' | null
  categoria_ids: number[]
  etiqueta_ids: number[]
  tarjeta_ids: number[]
  concepto_ids: number[]
}
