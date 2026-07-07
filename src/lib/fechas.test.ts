import { describe, it, expect } from 'vitest'
import { shiftMonth, resolvePeriodoTarjeta } from './fechas'

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

describe('resolvePeriodoTarjeta', () => {
  // Tarjeta que cierra el día 2.
  it('pago con día posterior al cierre → resumen del mes siguiente', () => {
    // 25-jun (día 25 > 2) → julio
    expect(resolvePeriodoTarjeta('2026-06-25', 2)).toEqual({ mes: 7, anio: 2026 })
  })

  it('pago con día anterior al cierre → resumen del propio mes del pago', () => {
    // 01-jul (día 1 < 2) → julio (el bug que se corrige: antes caía en agosto)
    expect(resolvePeriodoTarjeta('2026-07-01', 2)).toEqual({ mes: 7, anio: 2026 })
  })

  it('pago justo el día de cierre → mismo mes (se incluye el día de cierre)', () => {
    expect(resolvePeriodoTarjeta('2026-07-02', 2)).toEqual({ mes: 7, anio: 2026 })
  })

  it('hace wraparound de año cuando el pago es posterior al cierre en diciembre', () => {
    // 20-dic (día 20 > 2) → enero del año siguiente
    expect(resolvePeriodoTarjeta('2026-12-20', 2)).toEqual({ mes: 1, anio: 2027 })
  })

  it('no depende del mes fuente: 25-jun y 01-jul con cierre día 2 caen ambos en julio', () => {
    expect(resolvePeriodoTarjeta('2026-06-25', 2)).toEqual(resolvePeriodoTarjeta('2026-07-01', 2))
  })
})
