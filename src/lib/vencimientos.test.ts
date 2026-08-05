import { describe, it, expect } from 'vitest'
import { vencePorGasto } from './vencimientos'

describe('vencePorGasto', () => {
  it('gasto sin sub-items vence por sí mismo', () => {
    expect(vencePorGasto(false, 0)).toBe(true)
  })

  it('gasto normal con sub-items vence por los sub-items marcados', () => {
    expect(vencePorGasto(false, 3)).toBe(false)
  })

  it('resumen de tarjeta vence por sí mismo aunque tenga consumos propagados', () => {
    expect(vencePorGasto(true, 5)).toBe(true)
  })

  it('trata esTarjeta ausente como false', () => {
    expect(vencePorGasto(undefined, 2)).toBe(false)
    expect(vencePorGasto(null, 0)).toBe(true)
  })
})
