import { describe, it, expect } from 'vitest'
import {
  splitPropina,
  buildPropinaGasto,
  aplicarPropina,
  resolveCategoriaPropina,
  CONCEPTO_PROPINA,
  CATEGORIA_PROPINA,
  MODO_PROPINA_DEFAULT,
} from './propina'
import type { GastoFormData } from './types'

const base = (over: Partial<GastoFormData> = {}): GastoFormData => ({
  fecha_vencimiento: '2026-08-22',
  descripcion: 'Cena',
  casa_id: 1,
  tipo_pago: 'C',
  moneda_id: 3,
  tipo_cambio: 1,
  total_moneda: 25000,
  total_pagado: 0,
  pasaje_mes_siguiente: 0,
  prestamo_a_otro: 0,
  tarjeta_id: 7,
  cuota_actual: 1,
  cuotas_totales: 3,
  mes: 8,
  anio: 2026,
  notas: 'con Ana',
  confirmado: true,
  categoria_id: 4,
  etiqueta_ids: [2, 5],
  es_tarjeta: false,
  pagado_completo: true,
  ...over,
})

describe('splitPropina', () => {
  it('modo aparte: el total tipeado queda intacto y la propina se suma encima', () => {
    expect(splitPropina(25000, 3000, 'aparte')).toEqual({ total_gasto: 25000, total_propina: 3000 })
  })

  it('modo incluida: descuenta la propina del total tipeado', () => {
    expect(splitPropina(25000, 3000, 'incluida')).toEqual({ total_gasto: 22000, total_propina: 3000 })
  })

  it('devuelve null sin propina, para que el alta cree un solo gasto', () => {
    expect(splitPropina(25000, 0, 'aparte')).toBeNull()
    expect(splitPropina(25000, null, 'incluida')).toBeNull()
    expect(splitPropina(25000, undefined, 'aparte')).toBeNull()
    expect(splitPropina(25000, NaN, 'incluida')).toBeNull()
  })

  it('redondea a centavos: la resta de floats no puede dejar 66.73000000000002', () => {
    const r = splitPropina(100.10, 33.37, 'incluida')
    expect(r).toEqual({ total_gasto: 66.73, total_propina: 33.37 })
    // Con montos de dos decimales las dos partes reconstruyen el total tipeado.
    expect(r!.total_gasto + r!.total_propina).toBeCloseTo(100.10, 10)
  })

  it('acepta negativos (devolución con su ajuste de propina), igual que el resto de los montos', () => {
    expect(splitPropina(-25000, -3000, 'incluida')).toEqual({ total_gasto: -22000, total_propina: -3000 })
    expect(splitPropina(-25000, -3000, 'aparte')).toEqual({ total_gasto: -25000, total_propina: -3000 })
  })

  it('propina mayor que el total en modo incluida: no se recorta, el gasto cruza a negativo', () => {
    expect(splitPropina(1000, 1500, 'incluida')).toEqual({ total_gasto: -500, total_propina: 1500 })
  })

  it('total no numérico se trata como 0 en vez de propagar NaN', () => {
    expect(splitPropina(NaN, 500, 'incluida')).toEqual({ total_gasto: -500, total_propina: 500 })
  })
})

describe('buildPropinaGasto', () => {
  const split = { total_gasto: 22000, total_propina: 3000 }

  it('usa el concepto fijo y el monto de la propina', () => {
    const p = buildPropinaGasto(base(), split)
    expect(p.descripcion).toBe(CONCEPTO_PROPINA)
    expect(p.total_moneda).toBe(3000)
  })

  it('hereda el contexto de carga del gasto de origen', () => {
    const p = buildPropinaGasto(base(), split)
    expect(p).toMatchObject({
      fecha_vencimiento: '2026-08-22',
      casa_id: 1,
      tipo_pago: 'C',
      tarjeta_id: 7,
      moneda_id: 3,
      tipo_cambio: 1,
      mes: 8,
      anio: 2026,
      confirmado: true,
      pagado_completo: true,
    })
  })

  it('usa la categoría elegida para la propina, no la del gasto de origen', () => {
    const p = buildPropinaGasto(base({ categoria_id: 4, propina_categoria_id: 9 }), split)
    expect(p.categoria_id).toBe(9)
  })

  it('sin categoría de propina queda sin categoría, nunca con la del origen', () => {
    expect(buildPropinaGasto(base({ categoria_id: 4 }), split).categoria_id).toBeNull()
    expect(buildPropinaGasto(base({ categoria_id: 4, propina_categoria_id: null }), split).categoria_id).toBeNull()
  })

  it('etiquetas sin tocar (null) = las del gasto de origen', () => {
    expect(buildPropinaGasto(base({ etiqueta_ids: [2, 5] }), split).etiqueta_ids).toEqual([2, 5])
    expect(buildPropinaGasto(base({ etiqueta_ids: [2, 5], propina_etiqueta_ids: null }), split).etiqueta_ids).toEqual([2, 5])
  })

  it('etiquetas propias ganan sobre las heredadas', () => {
    const p = buildPropinaGasto(base({ etiqueta_ids: [2, 5], propina_etiqueta_ids: [8] }), split)
    expect(p.etiqueta_ids).toEqual([8])
  })

  it('un vacío explícito no hereda: es "sin etiquetas", no "sin tocar"', () => {
    const p = buildPropinaGasto(base({ etiqueta_ids: [2, 5], propina_etiqueta_ids: [] }), split)
    expect(p.etiqueta_ids).toEqual([])
  })

  it('limpia la clasificación propia para que el segundo gasto no la arrastre', () => {
    const p = buildPropinaGasto(base({ propina_categoria_id: 9, propina_etiqueta_ids: [8] }), split)
    expect(p.propina_categoria_id).toBeNull()
    expect(p.propina_etiqueta_ids).toBeNull()
  })

  it('no hereda cuotas: una propina no se financia', () => {
    const p = buildPropinaGasto(base(), split)
    expect(p.cuota_actual).toBeNull()
    expect(p.cuotas_totales).toBeNull()
  })

  it('no duplica el pago parcial ni los ajustes del gasto de origen', () => {
    const p = buildPropinaGasto(base({ pagado_completo: false, total_pagado: 5000, pasaje_mes_siguiente: 800, prestamo_a_otro: 200 }), split)
    expect(p.total_pagado).toBe(0)
    expect(p.pasaje_mes_siguiente).toBe(0)
    expect(p.prestamo_a_otro).toBe(0)
  })

  it('nunca es un resumen de tarjeta', () => {
    expect(buildPropinaGasto(base({ es_tarjeta: true }), split).es_tarjeta).toBe(false)
  })

  it('pisa las notas del origen con la trazabilidad al gasto', () => {
    expect(buildPropinaGasto(base(), split).notas).toBe('Propina de Cena')
  })

  it('normaliza la descripción del origen en las notas', () => {
    expect(buildPropinaGasto(base({ descripcion: '  Cena   con  Ana ' }), split).notas).toBe('Propina de Cena con Ana')
  })

  it('sin descripción de origen no inventa una nota', () => {
    expect(buildPropinaGasto(base({ descripcion: '   ' }), split).notas).toBe('')
  })

  it('no escribe "Propina de Propina" cuando el gasto ya es una propina', () => {
    expect(buildPropinaGasto(base({ descripcion: 'propina' }), split).notas).toBe('')
  })

  it('limpia los campos de propina para que el segundo gasto no arrastre uno tercero', () => {
    const p = buildPropinaGasto(base({ propina: 3000, propina_modo: 'incluida' }), split)
    expect(p.propina).toBe(0)
    expect(p.propina_modo).toBe(MODO_PROPINA_DEFAULT)
  })
})

describe('aplicarPropina', () => {
  it('sin propina devuelve el gasto tal cual y nada que crear aparte', () => {
    const data = base({ propina: 0 })
    expect(aplicarPropina(data)).toEqual({ principal: data, propina: null })
  })

  it('sin el campo cargado tampoco parte nada', () => {
    const data = base()
    expect(aplicarPropina(data).propina).toBeNull()
  })

  it('modo aparte: el principal conserva su total y la propina va encima', () => {
    const { principal, propina } = aplicarPropina(base({ propina: 3000, propina_modo: 'aparte' }))
    expect(principal.total_moneda).toBe(25000)
    expect(propina!.total_moneda).toBe(3000)
  })

  it('modo incluida: el principal queda con el total menos la propina', () => {
    const { principal, propina } = aplicarPropina(base({ propina: 3000, propina_modo: 'incluida' }))
    expect(principal.total_moneda).toBe(22000)
    expect(propina!.total_moneda).toBe(3000)
    // Lo registrado sigue sumando lo que realmente se pagó.
    expect(principal.total_moneda + propina!.total_moneda).toBe(25000)
  })

  it('sin modo explícito usa "aparte" (no descuenta un total que el usuario no pidió descontar)', () => {
    const { principal } = aplicarPropina(base({ propina: 3000, propina_modo: undefined }))
    expect(principal.total_moneda).toBe(25000)
  })

  it('ignora la propina en un resumen de tarjeta, aunque haya quedado tipeada', () => {
    const { principal, propina } = aplicarPropina(base({ es_tarjeta: true, propina: 3000, propina_modo: 'incluida' }))
    expect(propina).toBeNull()
    // Y el total del resumen no se toca.
    expect(principal.total_moneda).toBe(25000)
  })

  it('el principal conserva su propia clasificación, la propina lleva la suya', () => {
    const { principal, propina } = aplicarPropina(base({
      propina: 3000, categoria_id: 4, etiqueta_ids: [2, 5], propina_categoria_id: 9, propina_etiqueta_ids: [8],
    }))
    expect(principal.categoria_id).toBe(4)
    expect(principal.etiqueta_ids).toEqual([2, 5])
    expect(propina!.categoria_id).toBe(9)
    expect(propina!.etiqueta_ids).toEqual([8])
  })

  it('el principal conserva sus cuotas y notas propias', () => {
    const { principal } = aplicarPropina(base({ propina: 3000, propina_modo: 'incluida' }))
    expect(principal.cuota_actual).toBe(1)
    expect(principal.cuotas_totales).toBe(3)
    expect(principal.notas).toBe('con Ana')
  })
})

describe('resolveCategoriaPropina', () => {
  it('encuentra la categoría por nombre', () => {
    expect(resolveCategoriaPropina([{ id: 1, nombre: 'Comida' }, { id: 9, nombre: 'Propinas' }])).toBe(9)
  })

  it('matchea case-insensitive y con espacios sueltos, como el resto de los clasificadores', () => {
    expect(resolveCategoriaPropina([{ id: 9, nombre: 'PROPINAS' }])).toBe(9)
    expect(resolveCategoriaPropina([{ id: 9, nombre: '  propinas ' }])).toBe(9)
  })

  it('null si no existe, si la lista está vacía o si todavía no cargó', () => {
    expect(resolveCategoriaPropina([{ id: 1, nombre: 'Comida' }])).toBeNull()
    expect(resolveCategoriaPropina([])).toBeNull()
    expect(resolveCategoriaPropina(null)).toBeNull()
    expect(resolveCategoriaPropina(undefined)).toBeNull()
  })

  it('no confunde el singular con la categoría buscada', () => {
    expect(resolveCategoriaPropina([{ id: 3, nombre: 'Propina' }])).toBeNull()
  })
})
