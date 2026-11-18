import { describe, it, expect } from 'vitest'
import { debeAutocopiar, desdeAutocopia, periodoDestino, VENTANA_AUTOCOPIA_DIAS } from './tarjetas-autocopia'

const HOY = '2026-11-18'

describe('debeAutocopiar', () => {
  it('copia si el cierre fue ayer', () => {
    expect(debeAutocopiar({ mes: 11, anio: 2026, fechaCierre: '2026-11-17' }, HOY)).toBe(true)
  })

  it('no copia el mismo día del cierre (todavía acumula consumos)', () => {
    expect(debeAutocopiar({ mes: 11, anio: 2026, fechaCierre: HOY }, HOY)).toBe(false)
  })

  it('no copia si el cierre todavía no llegó', () => {
    expect(debeAutocopiar({ mes: 12, anio: 2026, fechaCierre: '2026-12-01' }, HOY)).toBe(false)
  })

  it('no copia si ya se copió automáticamente', () => {
    expect(
      debeAutocopiar({ mes: 11, anio: 2026, fechaCierre: '2026-11-17', autoCopiadoAt: new Date() }, HOY),
    ).toBe(false)
  })

  it('no copia cierres sin fecha', () => {
    expect(debeAutocopiar({ mes: 11, anio: 2026, fechaCierre: null }, HOY)).toBe(false)
  })

  it('respeta la ventana: copia en el límite y no más atrás (no arrastra el histórico)', () => {
    expect(debeAutocopiar({ mes: 11, anio: 2026, fechaCierre: '2026-11-08' }, HOY)).toBe(true)
    expect(debeAutocopiar({ mes: 11, anio: 2026, fechaCierre: '2026-11-07' }, HOY)).toBe(false)
    expect(debeAutocopiar({ mes: 6, anio: 2026, fechaCierre: '2026-05-28' }, HOY)).toBe(false)
  })

  it('el cierre de un período puede caer en el mes anterior', () => {
    expect(debeAutocopiar({ mes: 12, anio: 2026, fechaCierre: '2026-11-15' }, HOY)).toBe(true)
  })
})

describe('desdeAutocopia', () => {
  it('resta la ventana', () => {
    expect(VENTANA_AUTOCOPIA_DIAS).toBe(10)
    expect(desdeAutocopia(HOY)).toBe('2026-11-08')
  })

  it('cruza mes y año', () => {
    expect(desdeAutocopia('2027-01-03')).toBe('2026-12-24')
    expect(desdeAutocopia('2026-03-05', 10)).toBe('2026-02-23')
  })
})

describe('periodoDestino', () => {
  it('es el mes siguiente, con wraparound de año', () => {
    expect(periodoDestino({ mes: 11, anio: 2026 })).toEqual({ mes: 12, anio: 2026 })
    expect(periodoDestino({ mes: 12, anio: 2026 })).toEqual({ mes: 1, anio: 2027 })
  })
})
