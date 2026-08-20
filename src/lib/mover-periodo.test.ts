import { describe, it, expect } from 'vitest'
import { shiftFechaAPeriodo, ultimoDiaDelMes, parsePeriodoBody } from './mover-periodo'

describe('ultimoDiaDelMes', () => {
  it('meses de 31, 30 y 28 días', () => {
    expect(ultimoDiaDelMes(1, 2026)).toBe(31)
    expect(ultimoDiaDelMes(4, 2026)).toBe(30)
    expect(ultimoDiaDelMes(2, 2026)).toBe(28)
  })

  it('febrero de año bisiesto', () => {
    expect(ultimoDiaDelMes(2, 2024)).toBe(29)
    expect(ultimoDiaDelMes(2, 2000)).toBe(29)
    expect(ultimoDiaDelMes(2, 1900)).toBe(28)
  })

  it('diciembre', () => {
    expect(ultimoDiaDelMes(12, 2026)).toBe(31)
  })
})

describe('shiftFechaAPeriodo', () => {
  it('conserva el día al cambiar de mes', () => {
    expect(shiftFechaAPeriodo('2026-06-10', 7, 2026)).toBe('2026-07-10')
  })

  it('conserva el día al cambiar de año', () => {
    expect(shiftFechaAPeriodo('2026-12-05', 1, 2027)).toBe('2027-01-05')
  })

  it('recorta al último día cuando el destino es más corto', () => {
    expect(shiftFechaAPeriodo('2026-01-31', 2, 2026)).toBe('2026-02-28')
    expect(shiftFechaAPeriodo('2024-01-31', 2, 2024)).toBe('2024-02-29')
    expect(shiftFechaAPeriodo('2026-03-31', 4, 2026)).toBe('2026-04-30')
  })

  it('no desborda al mes siguiente al recortar', () => {
    expect(shiftFechaAPeriodo('2026-01-30', 2, 2026)).toBe('2026-02-28')
  })

  it('mover al mismo período la deja igual', () => {
    expect(shiftFechaAPeriodo('2026-06-10', 6, 2026)).toBe('2026-06-10')
  })

  it('devuelve null con formato inválido', () => {
    expect(shiftFechaAPeriodo('10/06/2026', 7, 2026)).toBeNull()
    expect(shiftFechaAPeriodo('', 7, 2026)).toBeNull()
  })
})

describe('parsePeriodoBody', () => {
  it('acepta un período válido', () => {
    expect(parsePeriodoBody({ mes: 7, anio: 2026 })).toEqual({ mes: 7, anio: 2026, moverFecha: false })
  })

  it('coerciona strings numéricos', () => {
    expect(parsePeriodoBody({ mes: '7', anio: '2026' })).toEqual({ mes: 7, anio: 2026, moverFecha: false })
  })

  it('mover_fecha sólo es true con el booleano exacto', () => {
    expect(parsePeriodoBody({ mes: 7, anio: 2026, mover_fecha: true })!.moverFecha).toBe(true)
    expect(parsePeriodoBody({ mes: 7, anio: 2026, mover_fecha: 'true' })!.moverFecha).toBe(false)
    expect(parsePeriodoBody({ mes: 7, anio: 2026, mover_fecha: 1 })!.moverFecha).toBe(false)
  })

  it('rechaza meses fuera de rango', () => {
    expect(parsePeriodoBody({ mes: 0, anio: 2026 })).toBeNull()
    expect(parsePeriodoBody({ mes: 13, anio: 2026 })).toBeNull()
    expect(parsePeriodoBody({ mes: 6.5, anio: 2026 })).toBeNull()
  })

  it('rechaza años absurdos y bodies incompletos', () => {
    expect(parsePeriodoBody({ mes: 7, anio: 1800 })).toBeNull()
    expect(parsePeriodoBody({ mes: 7, anio: 3000 })).toBeNull()
    expect(parsePeriodoBody({ mes: 7 })).toBeNull()
    expect(parsePeriodoBody({})).toBeNull()
    expect(parsePeriodoBody(null)).toBeNull()
  })
})
