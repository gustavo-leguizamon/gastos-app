import { describe, it, expect } from 'vitest'
import { totalesSeleccion, totalVisible, type GastoSeleccionLike } from './gastos-seleccion'

const g = (over: Partial<GastoSeleccionLike> & { id: number }): GastoSeleccionLike => ({
  total_ars: 0,
  total_pagado: 0,
  total_restante: 0,
  confirmado: true,
  items: [],
  ...over,
})

describe('totalVisible', () => {
  it('usa total_ars en un gasto confirmado aunque tenga sub-items', () => {
    expect(totalVisible(g({ id: 1, total_ars: 100, items: [{ monto: 30, incluye_en_total: true }] }))).toBe(100)
  })

  it('usa el subtotal de sub-items (sólo incluye_en_total) en un gasto sin confirmar', () => {
    expect(totalVisible(g({
      id: 1,
      total_ars: 100,
      confirmado: false,
      items: [{ monto: 30, incluye_en_total: true }, { monto: 50, incluye_en_total: false }],
    }))).toBe(30)
  })

  it('usa total_ars en un gasto sin confirmar sin sub-items', () => {
    expect(totalVisible(g({ id: 1, total_ars: 100, confirmado: false, items: null }))).toBe(100)
  })
})

describe('totalesSeleccion', () => {
  const gastos = [
    g({ id: 1, total_ars: 1000.1, total_pagado: 400, total_restante: 600.1 }),
    g({ id: 2, total_ars: 200.2, total_pagado: 200.2, total_restante: 0 }),
    g({ id: 3, total_ars: -50, total_pagado: 0, total_restante: -50 }),
    g({ id: 4, total_ars: 999, confirmado: false, items: [{ monto: 10, incluye_en_total: true }] }),
  ]

  it('suma sólo los seleccionados, redondeado a centavos', () => {
    expect(totalesSeleccion(gastos, new Set([1, 2]))).toEqual({ cantidad: 2, total: 1200.3, pagado: 600.2, restante: 600.1 })
  })

  it('resta los montos negativos y usa el total visible de los no confirmados', () => {
    expect(totalesSeleccion(gastos, new Set([3, 4])).total).toBe(-40)
  })

  it('ignora ids que no están cargados', () => {
    expect(totalesSeleccion(gastos, new Set([2, 99]))).toEqual({ cantidad: 1, total: 200.2, pagado: 200.2, restante: 0 })
  })

  it('sin selección da todo en 0', () => {
    expect(totalesSeleccion(gastos, new Set())).toEqual({ cantidad: 0, total: 0, pagado: 0, restante: 0 })
  })
})
