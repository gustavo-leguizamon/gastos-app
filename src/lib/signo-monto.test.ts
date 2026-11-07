import { describe, it, expect } from 'vitest'
import { tieneMagnitud, invertirSigno, aplicarNegativo, esNegativo } from './signo-monto'

describe('tieneMagnitud', () => {
  it('es false para vacío, 0, "-" e inválidos', () => {
    for (const v of [null, undefined, '', '  ', '-', '0', '0.00', '-0', 0, 'abc', NaN]) {
      expect(tieneMagnitud(v as never)).toBe(false)
    }
  })
  it('es true para números distintos de 0', () => {
    for (const v of ['12', '-12', '0.5', 3, -3]) expect(tieneMagnitud(v)).toBe(true)
  })
})

describe('invertirSigno', () => {
  it('agrega el menos a un positivo conservando los decimales tipeados', () => {
    expect(invertirSigno('12.50')).toBe('-12.50')
  })
  it('saca el menos de un negativo', () => {
    expect(invertirSigno('-12.50')).toBe('12.50')
  })
  it('acepta números (el valor de react-hook-form arranca como number)', () => {
    expect(invertirSigno(100)).toBe('-100')
    expect(invertirSigno(-100)).toBe('100')
  })
  it('devuelve null si no hay magnitud que invertir', () => {
    expect(invertirSigno('')).toBeNull()
    expect(invertirSigno(0)).toBeNull()
    expect(invertirSigno('0')).toBeNull()
    expect(invertirSigno(null)).toBeNull()
  })
  it('es involutivo', () => {
    expect(invertirSigno(invertirSigno('7.3')!)).toBe('7.3')
  })
})

describe('aplicarNegativo', () => {
  it('niega el primer número tipeado', () => {
    expect(aplicarNegativo('5')).toBe('-5')
  })
  it('no toca un valor sin magnitud (el pendiente sigue esperando)', () => {
    expect(aplicarNegativo('')).toBe('')
    expect(aplicarNegativo('0')).toBe('0')
    expect(aplicarNegativo('0.')).toBe('0.')
  })
  it('no duplica el menos', () => {
    expect(aplicarNegativo('-5')).toBe('-5')
  })
})

describe('esNegativo', () => {
  it('distingue negativos de positivos y vacíos', () => {
    expect(esNegativo('-1')).toBe(true)
    expect(esNegativo(-1)).toBe(true)
    expect(esNegativo('1')).toBe(false)
    expect(esNegativo('')).toBe(false)
    expect(esNegativo('-0')).toBe(false)
  })
})
