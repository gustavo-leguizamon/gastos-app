import { describe, it, expect } from 'vitest'
import { parseCuotas, formatCuotas } from './cuotas'

describe('parseCuotas', () => {
  it('vacío / null / espacios → sin cuotas', () => {
    for (const v of ['', '   ', null, undefined]) {
      expect(parseCuotas(v)).toEqual({ ok: true, cuota_actual: null, cuotas_totales: null })
    }
  })

  it('parsea "3/12"', () => {
    expect(parseCuotas('3/12')).toEqual({ ok: true, cuota_actual: 3, cuotas_totales: 12 })
  })

  it('tolera espacios alrededor del separador', () => {
    expect(parseCuotas(' 3 / 12 ')).toEqual({ ok: true, cuota_actual: 3, cuotas_totales: 12 })
  })

  it('un solo número es el total y arranca en 1', () => {
    expect(parseCuotas('12')).toEqual({ ok: true, cuota_actual: 1, cuotas_totales: 12 })
  })

  it('acepta cuota igual al total (última cuota)', () => {
    expect(parseCuotas('12/12')).toEqual({ ok: true, cuota_actual: 12, cuotas_totales: 12 })
  })

  it('rechaza cuota mayor al total', () => {
    expect(parseCuotas('13/12')).toEqual({ ok: false, error: 'La cuota no puede superar el total' })
  })

  it('rechaza ceros y negativos', () => {
    expect(parseCuotas('0/12').ok).toBe(false)
    expect(parseCuotas('-1/12').ok).toBe(false)
  })

  it('rechaza decimales', () => {
    expect(parseCuotas('1.5/12').ok).toBe(false)
  })

  it('rechaza texto no numérico', () => {
    expect(parseCuotas('abc').ok).toBe(false)
    expect(parseCuotas('a/b').ok).toBe(false)
  })

  it('rechaza pares incompletos y separadores de más', () => {
    expect(parseCuotas('3/').ok).toBe(false)
    expect(parseCuotas('/12').ok).toBe(false)
    expect(parseCuotas('1/2/3').ok).toBe(false)
  })
})

describe('formatCuotas', () => {
  it('sin cuotas → string vacío', () => {
    expect(formatCuotas(null, null)).toBe('')
  })

  it('par completo → "3/12"', () => {
    expect(formatCuotas(3, 12)).toBe('3/12')
  })

  it('par incompleto no inventa el lado faltante', () => {
    expect(formatCuotas(3, null)).toBe('3/')
    expect(formatCuotas(null, 12)).toBe('/12')
  })

  it('es inverso de parseCuotas para un par válido', () => {
    const p = parseCuotas('4/6')
    expect(p.ok).toBe(true)
    if (p.ok) expect(formatCuotas(p.cuota_actual, p.cuotas_totales)).toBe('4/6')
  })
})
