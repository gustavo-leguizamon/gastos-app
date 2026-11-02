import { describe, it, expect } from 'vitest'
import { cuotasFuturasDebito } from './cuotas-futuras'

const base = { tipoPago: 'D', cuotaActual: 2, cuotasTotales: 4, mes: 11, anio: 2026, fechaVencimiento: '2026-11-10' }

describe('cuotasFuturasDebito', () => {
  it('genera una cuota por mes hasta la última, con wraparound de año', () => {
    expect(cuotasFuturasDebito(base)).toEqual([
      { mes: 12, anio: 2026, fechaVencimiento: '2026-12-10', cuotaActual: 3 },
      { mes: 1, anio: 2027, fechaVencimiento: '2027-01-10', cuotaActual: 4 },
    ])
  })
  it('recorta el día al último del mes', () => {
    const r = cuotasFuturasDebito({ ...base, mes: 1, anio: 2027, fechaVencimiento: '2027-01-31', cuotaActual: 1, cuotasTotales: 2 })
    expect(r[0].fechaVencimiento).toBe('2027-02-28')
  })
  it('no genera nada para crédito, sin cuotas o en la última', () => {
    expect(cuotasFuturasDebito({ ...base, tipoPago: 'C' })).toEqual([])
    expect(cuotasFuturasDebito({ ...base, cuotaActual: null })).toEqual([])
    expect(cuotasFuturasDebito({ ...base, cuotaActual: 4 })).toEqual([])
  })
})
