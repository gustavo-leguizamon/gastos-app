import { describe, it, expect } from 'vitest'
import {
  sumItemsTotal,
  checkSubitemsTotal,
  difiereSubtotal,
  TOTAL_EPSILON,
} from './subitems-total'

const item = (monto: number, incluye_en_total = true) => ({ monto, incluye_en_total })

describe('sumItemsTotal', () => {
  it('suma sólo los items con incluye_en_total', () => {
    expect(sumItemsTotal([item(100), item(50, false), item(25)])).toBe(125)
  })

  it('devuelve 0 sin items', () => {
    expect(sumItemsTotal([])).toBe(0)
    expect(sumItemsTotal(null)).toBe(0)
    expect(sumItemsTotal(undefined)).toBe(0)
  })

  it('soporta montos negativos', () => {
    expect(sumItemsTotal([item(100), item(-30)])).toBe(70)
  })
})

describe('checkSubitemsTotal', () => {
  it('coincide cuando el subtotal iguala al total cargado', () => {
    const r = checkSubitemsTotal([item(600), item(400)], 1000)
    expect(r).toEqual({
      hasItems: true,
      itemsTotal: 1000,
      gastoTotal: 1000,
      diferencia: 0,
      matches: true,
    })
  })

  it('marca diferencia positiva cuando los sub-items suman de más', () => {
    const r = checkSubitemsTotal([item(1200)], 1000)
    expect(r.matches).toBe(false)
    expect(r.diferencia).toBe(200)
  })

  it('marca diferencia negativa cuando los sub-items suman de menos', () => {
    const r = checkSubitemsTotal([item(800)], 1000)
    expect(r.matches).toBe(false)
    expect(r.diferencia).toBe(-200)
  })

  it('ignora los items excluidos del total al comparar', () => {
    const r = checkSubitemsTotal([item(1000), item(500, false)], 1000)
    expect(r.matches).toBe(true)
    expect(r.itemsTotal).toBe(1000)
  })

  it('tolera diferencias menores a TOTAL_EPSILON', () => {
    expect(TOTAL_EPSILON).toBe(0.005)
    expect(checkSubitemsTotal([item(1000.001)], 1000).matches).toBe(true)
    // Un centavo de diferencia ya cuenta como "no coincide".
    expect(checkSubitemsTotal([item(1000.01)], 1000).matches).toBe(false)
  })

  it('sin items no hay comparación (matches true, hasItems false)', () => {
    const r = checkSubitemsTotal([], 1000)
    expect(r.hasItems).toBe(false)
    expect(r.matches).toBe(true)
    expect(r.itemsTotal).toBe(0)
  })

  it('un gasto en 0 con sub-items cargados difiere', () => {
    const r = checkSubitemsTotal([item(500)], 0)
    expect(r.matches).toBe(false)
    expect(r.diferencia).toBe(500)
  })
})

describe('difiereSubtotal', () => {
  it('es true sólo con items y subtotal distinto', () => {
    expect(difiereSubtotal([item(900)], 1000)).toBe(true)
    expect(difiereSubtotal([item(1000)], 1000)).toBe(false)
    expect(difiereSubtotal([], 1000)).toBe(false)
    expect(difiereSubtotal(undefined, 1000)).toBe(false)
  })

  it('es true si todos los items están excluidos del total y el gasto no es 0', () => {
    expect(difiereSubtotal([item(500, false)], 1000)).toBe(true)
  })
})
