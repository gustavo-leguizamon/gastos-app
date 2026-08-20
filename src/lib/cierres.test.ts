import { describe, it, expect } from 'vitest'
import { addMeses, generarSiguienteCierre, ultimoCierre, type CierreBase } from './cierres'

function cierre(over: Partial<CierreBase> = {}): CierreBase {
  return {
    mes: 6,
    anio: 2026,
    fechaCierre: '2026-06-20',
    fechaVencimiento: '2026-07-05',
    fechaProximoCierre: '2026-07-20',
    ...over,
  }
}

describe('addMeses', () => {
  it('suma un mes conservando el día', () => {
    expect(addMeses('2026-06-20', 1)).toBe('2026-07-20')
  })

  it('cruza el año', () => {
    expect(addMeses('2026-12-15', 1)).toBe('2027-01-15')
  })

  it('recorta al último día del mes destino', () => {
    expect(addMeses('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMeses('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMeses('2026-08-31', 1)).toBe('2026-09-30')
  })

  it('acepta n negativo', () => {
    expect(addMeses('2026-01-15', -1)).toBe('2025-12-15')
  })

  it('devuelve null con fecha inválida o nula', () => {
    expect(addMeses(null, 1)).toBeNull()
    expect(addMeses('', 1)).toBeNull()
    expect(addMeses('20/06/2026', 1)).toBeNull()
  })
})

describe('generarSiguienteCierre', () => {
  it('el próximo cierre del último período es la fecha de cierre del siguiente', () => {
    const g = generarSiguienteCierre(cierre())
    expect(g).toEqual({
      mes: 7,
      anio: 2026,
      fechaCierre: '2026-07-20',
      fechaVencimiento: '2026-08-05',
      fechaProximoCierre: '2026-08-20',
    })
  })

  it('cruza el año en diciembre', () => {
    const g = generarSiguienteCierre(cierre({
      mes: 12, anio: 2026,
      fechaCierre: '2026-12-20', fechaVencimiento: '2027-01-05', fechaProximoCierre: '2027-01-20',
    }))
    expect(g.mes).toBe(1)
    expect(g.anio).toBe(2027)
    expect(g.fechaCierre).toBe('2027-01-20')
    expect(g.fechaVencimiento).toBe('2027-02-05')
  })

  it('sin fechaProximoCierre cae a fechaCierre + 1 mes', () => {
    const g = generarSiguienteCierre(cierre({ fechaProximoCierre: null }))
    expect(g.fechaCierre).toBe('2026-07-20')
    expect(g.fechaProximoCierre).toBe('2026-08-20')
  })

  it('un último cierre incompleto genera uno incompleto, no fechas inventadas', () => {
    const g = generarSiguienteCierre(cierre({
      fechaCierre: null, fechaVencimiento: null, fechaProximoCierre: null,
    }))
    expect(g).toEqual({
      mes: 7, anio: 2026, fechaCierre: null, fechaVencimiento: null, fechaProximoCierre: null,
    })
  })

  it('recorta los días que no existen en el mes destino', () => {
    const g = generarSiguienteCierre(cierre({
      mes: 1, anio: 2026,
      fechaCierre: '2026-01-31', fechaVencimiento: '2026-01-31', fechaProximoCierre: '2026-02-28',
    }))
    expect(g.fechaVencimiento).toBe('2026-02-28')
  })
})

describe('ultimoCierre', () => {
  it('devuelve el de mayor año y mes', () => {
    const cs = [
      { mes: 12, anio: 2025 },
      { mes: 2, anio: 2026 },
      { mes: 7, anio: 2026 },
      { mes: 1, anio: 2026 },
    ]
    expect(ultimoCierre(cs)).toEqual({ mes: 7, anio: 2026 })
  })

  it('el año manda sobre el mes', () => {
    expect(ultimoCierre([{ mes: 12, anio: 2025 }, { mes: 1, anio: 2026 }])).toEqual({ mes: 1, anio: 2026 })
  })

  it('lista vacía o nula devuelve null', () => {
    expect(ultimoCierre([])).toBeNull()
    expect(ultimoCierre(null as any)).toBeNull()
  })
})
