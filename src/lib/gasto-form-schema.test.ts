import { describe, it, expect } from 'vitest'
import { gastoFormSchema } from './gasto-form-schema'

const base = {
  fecha_vencimiento: '2026-07-10',
  descripcion: 'Reintegro Visa',
  casa_id: 1,
  tipo_pago: 'D',
  moneda_id: 1,
  tipo_cambio: 1,
  total_moneda: 1000,
  total_pagado: 0,
  pasaje_mes_siguiente: 0,
  prestamo_a_otro: 0,
  tarjeta_id: null,
  cuota_actual: null,
  cuotas_totales: null,
  mes: 7,
  anio: 2026,
  notas: '',
  confirmado: true,
  categoria_id: null,
  etiqueta_ids: [],
  es_tarjeta: false,
  pagado_completo: false,
}

const validate = (over: Record<string, unknown>) => gastoFormSchema.validate({ ...base, ...over })

describe('gastoFormSchema — montos negativos', () => {
  // Devoluciones/reintegros de tarjeta: todos los montos deben admitir negativos.
  it.each(['total_moneda', 'total_pagado', 'pasaje_mes_siguiente', 'prestamo_a_otro'])(
    'acepta %s negativo',
    async (field) => {
      const out = await validate({ [field]: -1500.5 })
      expect(out[field as keyof typeof out]).toBe(-1500.5)
    },
  )

  it('acepta un gasto íntegramente negativo (total y pagado)', async () => {
    const out = await validate({ total_moneda: -2000, total_pagado: -2000 })
    expect(out.total_moneda).toBe(-2000)
    expect(out.total_pagado).toBe(-2000)
  })
})

describe('gastoFormSchema — pisos que se mantienen', () => {
  it('rechaza tipo_cambio 0 o negativo', async () => {
    await expect(validate({ moneda_id: 2, tipo_cambio: 0 })).rejects.toThrow('Debe ser > 0')
    await expect(validate({ moneda_id: 2, tipo_cambio: -1 })).rejects.toThrow('Debe ser > 0')
  })

  it('rechaza cuotas menores a 1', async () => {
    await expect(validate({ cuota_actual: 0 })).rejects.toThrow('Debe ser >= 1')
    await expect(validate({ cuotas_totales: -3 })).rejects.toThrow('Debe ser >= 1')
  })

  it('exige tarjeta cuando tipo_pago es C', async () => {
    await expect(validate({ tipo_pago: 'C', tarjeta_id: null })).rejects.toThrow('Seleccioná una tarjeta')
    const out = await validate({ tipo_pago: 'C', tarjeta_id: 4, total_moneda: -500 })
    expect(out.tarjeta_id).toBe(4)
  })

  it('sigue exigiendo casa, moneda y descripción', async () => {
    await expect(validate({ casa_id: 0 })).rejects.toThrow('Seleccioná una casa')
    await expect(validate({ moneda_id: 0 })).rejects.toThrow('Seleccioná una moneda')
    await expect(validate({ descripcion: '' })).rejects.toThrow('Requerido')
  })
})
