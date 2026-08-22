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

describe('gastoFormSchema — propina', () => {
  it('sin cargar nada default a 0 y modo "aparte"', async () => {
    const out = await validate({})
    expect(out.propina).toBe(0)
    expect(out.propina_modo).toBe('aparte')
  })

  it('un campo vacío (NaN al castear) cuenta como sin propina, no como error', async () => {
    const out = await validate({ propina: '' })
    expect(out.propina).toBe(0)
  })

  it('acepta negativos, como el resto de los montos', async () => {
    expect((await validate({ propina: -300 })).propina).toBe(-300)
  })

  it('acepta los dos modos y rechaza cualquier otro', async () => {
    expect((await validate({ propina_modo: 'incluida' })).propina_modo).toBe('incluida')
    await expect(validate({ propina_modo: 'mitad' })).rejects.toThrow()
  })
})

describe('gastoFormSchema — clasificación propia de la propina', () => {
  it('default: sin categoría y etiquetas en null (= heredar las del gasto)', async () => {
    const out = await validate({})
    expect(out.propina_categoria_id).toBeNull()
    expect(out.propina_etiqueta_ids).toBeNull()
  })

  it('distingue el vacío explícito del "sin tocar"', async () => {
    expect((await validate({ propina_etiqueta_ids: [] })).propina_etiqueta_ids).toEqual([])
    expect((await validate({ propina_etiqueta_ids: [8, 9] })).propina_etiqueta_ids).toEqual([8, 9])
  })
})
