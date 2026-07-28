import * as yup from 'yup'

/**
 * Schema de validación del formulario de gasto (`GastoForm`).
 *
 * Montos: `total_moneda`, `total_pagado`, `pasaje_mes_siguiente` y `prestamo_a_otro`
 * admiten valores negativos (devoluciones / reintegros / ajustes). El único campo
 * numérico con piso es `tipo_cambio` (> 0) y las cuotas (>= 1).
 */
export const gastoFormSchema = yup.object({
  fecha_vencimiento: yup.string().required('Requerido'),
  descripcion: yup.string().required('Requerido').max(200),
  casa_id: yup.number().required('Requerido').min(1, 'Seleccioná una casa'),
  tipo_pago: yup.string().oneOf(['C', 'D']).required('Requerido'),
  moneda_id: yup.number().required('Requerido').min(1, 'Seleccioná una moneda'),
  tipo_cambio: yup.number().required('Requerido').min(0.0001, 'Debe ser > 0'),
  total_moneda: yup.number().required('Requerido'),
  total_pagado: yup.number().required('Requerido'),
  pasaje_mes_siguiente: yup.number().required('Requerido'),
  prestamo_a_otro: yup.number().required('Requerido'),
  tarjeta_id: yup
    .number()
    .nullable()
    .when('tipo_pago', {
      is: 'C',
      then: (s) => s.typeError('Seleccioná una tarjeta').required('Seleccioná una tarjeta').min(1, 'Seleccioná una tarjeta'),
      otherwise: (s) => s.optional(),
    }),
  cuota_actual: yup.number().nullable().optional().min(1, 'Debe ser >= 1'),
  cuotas_totales: yup.number().nullable().optional().min(1, 'Debe ser >= 1'),
  mes: yup.number().required(),
  anio: yup.number().required(),
  notas: yup.string().optional().default(''),
  confirmado: yup.boolean().required().default(true),
  categoria_id: yup.number().nullable().default(null),
  etiqueta_ids: yup.array().of(yup.number()).default([]),
  es_tarjeta: yup.boolean().required().default(false),
  pagado_completo: yup.boolean().required().default(false),
})
