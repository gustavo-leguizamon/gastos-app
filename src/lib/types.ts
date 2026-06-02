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

export interface GastoItem {
  id: number
  gasto_id: number
  descripcion: string
  monto: number
  fecha: string | null
  cuota_actual: number | null
  cuotas_totales: number | null
  incluye_en_total: boolean
  incluye_en_vencimiento: boolean
  verificado: boolean
  categoria_id: number | null
  categoria_nombre?: string | null
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
  categoria_id: number | null
  categoria_nombre?: string | null
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
