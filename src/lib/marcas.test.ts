import { describe, it, expect } from 'vitest'
import { MARCAS, MARCA_ESTILOS, marcaAncho, marcaColor, marcaLabel, resolveMarca, tarjetaTitulo } from './marcas'

describe('resolveMarca', () => {
  it('resuelve los valores guardados en Tarjeta.marca', () => {
    for (const { value } of MARCAS.filter(m => m.value !== 'otra')) {
      expect(resolveMarca(value)).toBe(value)
    }
  })

  it('resuelve texto libre sin importar mayúsculas ni espacios', () => {
    expect(resolveMarca('  VISA ')).toBe('visa')
    expect(resolveMarca('MasterCard')).toBe('mastercard')
    expect(resolveMarca('American Express')).toBe('amex')
    expect(resolveMarca('Naranja X')).toBe('naranja')
    expect(resolveMarca('Cabal')).toBe('cabal')
  })

  it('devuelve null sin marca, con "otra" o con texto desconocido', () => {
    expect(resolveMarca(null)).toBeNull()
    expect(resolveMarca(undefined)).toBeNull()
    expect(resolveMarca('')).toBeNull()
    expect(resolveMarca('otra')).toBeNull()
    expect(resolveMarca('Maestro')).toBeNull()
  })
})

describe('marcaColor / marcaLabel', () => {
  it('el acento puede diferir del fondo (Mastercard va sobre blanco)', () => {
    expect(marcaColor('mastercard')).toBe('#eb001b')
    expect(MARCA_ESTILOS.mastercard.fondo).toBe('#ffffff')
  })

  it('label legible y undefined si no se reconoce', () => {
    expect(marcaLabel('amex')).toBe('American Express')
    expect(marcaLabel('otra')).toBeUndefined()
    expect(marcaColor(null)).toBeUndefined()
  })

  it('cada marca elegible (menos "otra") tiene estilo', () => {
    for (const { value } of MARCAS.filter(m => m.value !== 'otra')) {
      expect(MARCA_ESTILOS[value as keyof typeof MARCA_ESTILOS]).toBeDefined()
    }
  })
})

describe('tarjetaTitulo', () => {
  it('"Banco (Marca)" sin repetir la marca aunque el nombre de la tarjeta sea la marca', () => {
    expect(tarjetaTitulo({ nombre: 'American express', banco: 'Santander', marca: 'amex' })).toBe('Santander (American Express)')
  })

  it('sin texto de banco usa el banco de la lista', () => {
    expect(tarjetaTitulo({ nombre: 'Visa', banco: null, banco_logo: 'galicia', marca: 'visa' })).toBe('Galicia (Visa)')
  })

  it('sin marca, el nombre de la tarjeta va entre paréntesis para distinguirla', () => {
    expect(tarjetaTitulo({ nombre: 'Sabrina', banco: 'Mercado Pago', marca: 'otra' })).toBe('Mercado Pago (Sabrina)')
    expect(tarjetaTitulo({ nombre: 'Mercado Pago', banco: 'Mercado Pago', marca: null })).toBe('Mercado Pago')
  })

  it('sin banco, "Nombre (Marca)"; el slug "otro" no cuenta como banco', () => {
    expect(tarjetaTitulo({ nombre: 'Naranja', banco: null, banco_logo: 'otro', marca: 'visa' })).toBe('Naranja (Visa)')
    expect(tarjetaTitulo({ nombre: '', banco: null, marca: 'visa' })).toBe('Visa')
  })
})

describe('marcaAncho', () => {
  it('respeta la relación 44:32 del logo', () => {
    expect(marcaAncho(32)).toBe(44)
    expect(marcaAncho(22)).toBe(30)
    expect(marcaAncho(20)).toBe(28)
  })
})
