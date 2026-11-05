import { describe, it, expect } from 'vitest'
import { fmtCantidad, fmtPrecioUnitario, precioCampo } from './formato'

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

describe('fmtCantidad', () => {
  const pan = { unidad: 'g', subunidad_de: 'kg' as const, mostrar_en_multiplo: true }

  it('en kg si el artículo lo prefiere (lo guardado está en g)', () => {
    expect(fmtCantidad(2500, pan)).toBe('2,5 kg')
    expect(fmtCantidad(1100, pan)).toBe('1,1 kg')
  })

  it('en su unidad si no lo prefiere, o si no es g/ml', () => {
    expect(fmtCantidad(2500, { ...pan, mostrar_en_multiplo: false })).toBe('2.500 g')
    expect(fmtCantidad(3, { unidad: 'un', subunidad_de: null, mostrar_en_multiplo: true })).toBe('3 un')
  })
})

describe('fmtPrecioUnitario', () => {
  const sinEspacios = (t: string) => t.replace(/\s/g, ' ')

  it('por g/mm muestra hasta 4 decimales: redondear a centavos lo dejaría en $0,02', () => {
    expect(sinEspacios(fmtPrecioUnitario(6.698))).toBe('$ 6,698')
    expect(sinEspacios(fmtPrecioUnitario(0.019047))).toBe('$ 0,019')
  })

  it('desde $100 redondea a centavos como el resto de los precios', () => {
    expect(sinEspacios(fmtPrecioUnitario(1234.5678))).toBe('$ 1.234,57')
  })

  it('siempre al menos 2 decimales', () => {
    expect(sinEspacios(fmtPrecioUnitario(5))).toBe('$ 5,00')
  })
})
