import { describe, it, expect } from 'vitest'
import { shiftMonth } from './fechas'

describe('shiftMonth', () => {
  it('avanza dentro del mismo año', () => {
    expect(shiftMonth(6, 2026, 1)).toEqual({ mes: 7, anio: 2026 })
    expect(shiftMonth(6, 2026, 2)).toEqual({ mes: 8, anio: 2026 })
  })

  it('hace wraparound de diciembre al año siguiente', () => {
    expect(shiftMonth(12, 2026, 1)).toEqual({ mes: 1, anio: 2027 })
    expect(shiftMonth(11, 2026, 2)).toEqual({ mes: 1, anio: 2027 })
    expect(shiftMonth(12, 2026, 2)).toEqual({ mes: 2, anio: 2027 })
  })

  it('retrocede con n negativo cruzando el año', () => {
    expect(shiftMonth(1, 2026, -1)).toEqual({ mes: 12, anio: 2025 })
    expect(shiftMonth(2, 2026, -3)).toEqual({ mes: 11, anio: 2025 })
  })

  it('n = 0 devuelve el mismo par', () => {
    expect(shiftMonth(5, 2026, 0)).toEqual({ mes: 5, anio: 2026 })
  })

  it('salta varios años', () => {
    expect(shiftMonth(6, 2026, 24)).toEqual({ mes: 6, anio: 2028 })
  })
})
