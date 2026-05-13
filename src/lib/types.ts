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

export interface Tarjeta {
  id: number
  nombre: string
  banco: string | null
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
  mes: number
  anio: number
  notas: string | null
  created_at: string
  updated_at: string
  pagos: Pago[]
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
  mes: number
  anio: number
  notas: string
}

export interface Resumen {
  total_gastos: number
  total_restante: number
  total_pagado: number
  pagar_hoy: number
}

export interface FiltrosGastos {
  mes: number
  anio: number
  casa_id: number | null
  tipo_pago: 'C' | 'D' | null
}
