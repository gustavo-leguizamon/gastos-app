import { describe, it, expect } from 'vitest'
import { BANCOS, resolveBanco, bancoColor, bancoLabel, hasBancoIcono } from './bancos'

describe('BANCOS', () => {
  it('no tiene slugs duplicados', () => {
    const values = BANCOS.map(b => b.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it('todas las siglas tienen entre 1 y 4 caracteres', () => {
    for (const b of BANCOS) {
      expect(b.sigla.length).toBeGreaterThanOrEqual(1)
      expect(b.sigla.length).toBeLessThanOrEqual(4)
    }
  })
})

describe('resolveBanco', () => {
  it('gana el slug explícito sobre el texto libre', () => {
    expect(resolveBanco('galicia', 'Santander Río')?.value).toBe('galicia')
  })

  it('acepta el slug con mayúsculas o espacios', () => {
    expect(resolveBanco(' Galicia ')?.value).toBe('galicia')
  })

  it('devuelve null si el slug no está en la lista', () => {
    expect(resolveBanco('banco-inexistente')).toBeNull()
  })

  it('infiere el banco del texto libre cuando no hay slug', () => {
    expect(resolveBanco(null, 'Galicia')?.value).toBe('galicia')
    expect(resolveBanco(null, 'Banco Santander')?.value).toBe('santander')
    expect(resolveBanco(undefined, 'BBVA Frances')?.value).toBe('bbva')
  })

  it('ignora acentos y mayúsculas al inferir', () => {
    expect(resolveBanco(null, 'Banco Nación')?.value).toBe('nacion')
    expect(resolveBanco(null, 'UALÁ')?.value).toBe('uala')
  })

  it('matchea por alias', () => {
    expect(resolveBanco(null, 'BNA')?.value).toBe('nacion')
    expect(resolveBanco(null, 'Bapro')?.value).toBe('provincia')
    expect(resolveBanco(null, 'Mercado Pago')?.value).toBe('mercadopago')
    expect(resolveBanco(null, 'Frances')?.value).toBe('bbva')
  })

  it('nunca infiere "otro" desde el texto libre', () => {
    expect(resolveBanco(null, 'Otro banco')).toBeNull()
    expect(resolveBanco('otro')?.value).toBe('otro')
  })

  it('devuelve null sin slug ni texto útil', () => {
    expect(resolveBanco(null, null)).toBeNull()
    expect(resolveBanco(null, '   ')).toBeNull()
    expect(resolveBanco(undefined)).toBeNull()
    expect(resolveBanco('', 'Banco Desconocido SA')).toBeNull()
  })
})

describe('hasBancoIcono', () => {
  it('es true si hay imagen subida, aunque no haya banco resuelto', () => {
    expect(hasBancoIcono('data:image/png;base64,AAAA', null, null)).toBe(true)
    expect(hasBancoIcono('data:image/png;base64,AAAA', null, 'Banco Desconocido')).toBe(true)
  })

  it('es true si no hay imagen pero el banco se resuelve por slug o texto', () => {
    expect(hasBancoIcono(null, 'galicia')).toBe(true)
    expect(hasBancoIcono(undefined, null, 'Santander')).toBe(true)
  })

  it('es false cuando no hay ni imagen ni banco resoluble', () => {
    expect(hasBancoIcono(null, null, null)).toBe(false)
    expect(hasBancoIcono(undefined, undefined, 'Banco Desconocido SA')).toBe(false)
    expect(hasBancoIcono('', '', '')).toBe(false)
  })
})

describe('bancoColor / bancoLabel', () => {
  it('devuelven color y label del banco resuelto', () => {
    expect(bancoColor('santander')).toBe('#ec0000')
    expect(bancoLabel(null, 'Galicia')).toBe('Galicia')
  })

  it('devuelven undefined cuando no hay match', () => {
    expect(bancoColor(null, null)).toBeUndefined()
    expect(bancoLabel('nope')).toBeUndefined()
  })
})
