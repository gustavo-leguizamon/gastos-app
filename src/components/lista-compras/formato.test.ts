import { describe, it, expect } from 'vitest'
import { precioCampo } from './formato'

describe('precioCampo', () => {
  it('redondea a centavos el promedio ponderado', () => {
    expect(precioCampo(5190.178571)).toBe('5190.18')
    expect(precioCampo(1060.004)).toBe('1060')
  })

  it('no agrega decimales de más', () => {
    expect(precioCampo(1000)).toBe('1000')
    expect(precioCampo(12.5)).toBe('12.5')
    expect(precioCampo(0)).toBe('0')
  })
})
