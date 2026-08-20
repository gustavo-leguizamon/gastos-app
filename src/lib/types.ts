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

/** Banco emisor, elegido de una lista fija (ver `BANCOS` en `BancoLogo.tsx`). */
export type TarjetaBanco =
  | 'galicia' | 'santander' | 'bbva' | 'nacion' | 'provincia' | 'ciudad' | 'macro'
  | 'icbc' | 'hsbc' | 'supervielle' | 'patagonia' | 'credicoop' | 'comafi'
  | 'hipotecario' | 'brubank' | 'uala' | 'naranja' | 'mercadopago' | 'otro'

export interface Tarjeta {
  id: number
  nombre: string
  banco: string | null
  marca: TarjetaMarca | null
  banco_logo: TarjetaBanco | null
  /** Icono subido por el usuario (data URI). Gana sobre `banco_logo`. */
  banco_icono: string | null
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
  // Cantidad de gastos + sub-items que la referencian (sólo en GET /api/categorias).
  uso?: number
}

// Etiqueta: corte transversal (M2M). Misma forma que Categoria.
export interface Etiqueta {
  id: number
  nombre: string
  // Cantidad de gastos + sub-items que la referencian (sólo en GET /api/etiquetas).
  uso?: number
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
  tarjeta_banco_logo?: TarjetaBanco | null
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

export interface Settings {
  estim_meses_atras: number
  estim_missing_behavior: 'zero' | 'average_found'
  estim_incluir_cuotas_vigentes: boolean
  estim_excluir_ultima_cuota: boolean
  /** Casa preseleccionada al abrir el alta de un gasto (null = sin default). */
  casa_default_id: number | null
}

/**
 * Valores con los que se prefillea el alta al elegir un concepto ya usado: se leen del último
 * gasto de ese concepto (`GET /api/conceptos/[id]/ultimo-uso`). `origen` identifica de qué mes
 * salieron para poder mostrarlo en el form. Null cuando el concepto no tiene histórico.
 */
export interface ConceptoDefaults {
  casa_id: number
  tipo_pago: 'C' | 'D'
  moneda_id: number
  tipo_cambio: number
  tarjeta_id: number | null
  categoria_id: number | null
  etiqueta_ids: number[]
  total_moneda: number
  origen: { mes: number; anio: number }
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
  /** Lo que ya venció y sigue impago dentro del mes consultado. */
  total_vencido: number
  total_proximo_mes: number
  /** Suma de los ingresos cargados para el mes. */
  total_ingresos: number
  /** Lo gastado en débito/efectivo (`tipo_pago === 'D'`), incluye los resúmenes de tarjeta. */
  total_debito: number
  /** `total_ingresos − total_debito`. */
  total_ahorro: number
  /** `total_ahorro` como % de `total_ingresos` (0 si no hay ingresos). */
  ahorro_pct: number
}

/**
 * Ingreso de dinero de un mes. Se cargan varios (los cobros entran en días distintos) y el
 * total del mes es la suma. `casa_id` opcional: sin casa el ingreso es general y cuenta para
 * cualquier casa que se filtre.
 */
export interface Ingreso {
  id: number
  fecha: string
  mes: number
  anio: number
  moneda_id: number
  moneda_codigo: string | null
  moneda_simbolo: string | null
  /** Cotización a ARS. Siempre 1 cuando la moneda es ARS (el caso normal). */
  tipo_cambio: number
  /** Monto en la moneda del ingreso. */
  monto_moneda: number
  /** `monto_moneda * tipo_cambio` — derivado, no se persiste. */
  monto_ars: number
  descripcion: string | null
  casa_id: number | null
  casa_nombre: string | null
  created_at: string
  updated_at: string
}

export interface Inversion {
  id: number
  nombre: string
  /** Moneda de los montos de sus movimientos. `null` = sin declarar, se muestra como ARS. */
  moneda_id: number | null
  moneda_codigo: string | null
  moneda_simbolo: string | null
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

/** Partición por casa. Misma forma que `ReporteCategoria`. */
export interface ReporteCasa {
  id: number | null
  nombre: string
  total_ars: number
}

export interface Reporte {
  kpis: {
    total: number
    promedio_mensual: number
    cantidad_gastos: number
    meses: number
    /** Total de la ventana anterior del mismo largo. `null` si no se pidió comparación. */
    total_previo: number | null
    /** Variación % contra `total_previo`. `null` sin comparación o si el previo fue 0. */
    variacion_pct: number | null
  }
  por_categoria: ReporteCategoria[]
  por_etiqueta: ReporteCategoria[]
  por_mes: ReporteMes[]
  top_conceptos: ReporteConcepto[]
  por_tarjeta: ReporteTarjeta[]
  por_tipo_pago: ReporteTipoPago[]
  por_casa: ReporteCasa[]
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

/** Tope mensual de una categoría. La ausencia de fila = "sin presupuesto" (no es un 0). */
export interface Presupuesto {
  id: number
  categoria_id: number
  categoria_nombre: string | null
  mes: number
  anio: number
  monto: number
}

export type EstadoPresupuesto = 'ok' | 'cerca' | 'excedido'

/** Una categoría con su tope (si tiene) y lo que se lleva gastado del período. */
export interface EjecucionPresupuesto {
  categoria_id: number
  categoria_nombre: string
  /** `null` cuando la categoría tiene gasto pero no tiene tope cargado. */
  monto: number | null
  gastado: number
  restante: number | null
  consumido_pct: number | null
  estado: EstadoPresupuesto
}

export interface TotalesPresupuesto {
  presupuestado: number
  /** Sólo lo gastado en categorías **con** tope, para que sea comparable con el total. */
  gastado: number
  /** Lo gastado en categorías sin tope, informado aparte. */
  sin_presupuesto: number
  restante: number
  consumido_pct: number | null
  excedidas: number
}

export interface PresupuestosResponse {
  mes: number
  anio: number
  presupuestos: Presupuesto[]
  ejecucion: EjecucionPresupuesto[]
  totales: TotalesPresupuesto
}
