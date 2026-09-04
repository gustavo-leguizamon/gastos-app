import { describe, it, expect } from 'vitest'
import { addMeses, estadoCiclo, generarSiguienteCierre, ultimoCierre, type CierreBase } from './cierres'

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

describe('estadoCiclo', () => {
  const ciclo = { fechaCierre: '2026-08-10', fechaProximoCierre: '2026-09-09' } // 30 días

  it('marca cerrado cuando el próximo cierre ya pasó', () => {
    expect(estadoCiclo(ciclo, '2026-09-10')).toEqual({ estado: 'cerrado', dias: -1, progreso: 1 })
  })

  it('el día del cierre todavía cuenta como abierto', () => {
    expect(estadoCiclo(ciclo, '2026-09-09')).toEqual({ estado: 'abierto', dias: 0, progreso: 1 })
  })

  it('cuenta los días que faltan y el progreso del ciclo', () => {
    expect(estadoCiclo(ciclo, '2026-08-25')).toEqual({ estado: 'abierto', dias: 15, progreso: 0.5 })
  })

  it('sin fechaProximoCierre y con el cierre ya pasado no hay nada que decir', () => {
    expect(estadoCiclo({ fechaCierre: '2026-08-10', fechaProximoCierre: null }, '2026-08-25'))
      .toEqual({ estado: 'sin_fecha', dias: null, progreso: null })
    expect(estadoCiclo(null, '2026-08-25')).toEqual({ estado: 'sin_fecha', dias: null, progreso: null })
    expect(estadoCiclo({ fechaCierre: null, fechaProximoCierre: null }, '2026-08-25').estado).toBe('sin_fecha')
  })

  it('sin fechaProximoCierre pero con el cierre por venir mide el ciclo actual', () => {
    // Ciclo derivado 2026-08-05 → 2026-09-05 (31 días); hoy 2026-09-03 → faltan 2, 29/31.
    const r = estadoCiclo({ fechaCierre: '2026-09-05', fechaProximoCierre: null }, '2026-09-03')
    expect(r.estado).toBe('por_cerrar')
    expect(r.dias).toBe(2)
    expect(r.progreso).toBeCloseTo(29 / 31)
  })

  it('el día del cierre todavía cuenta como por_cerrar, no como sin_fecha', () => {
    expect(estadoCiclo({ fechaCierre: '2026-09-05', fechaProximoCierre: null }, '2026-09-05'))
      .toEqual({ estado: 'por_cerrar', dias: 0, progreso: 1 })
    expect(estadoCiclo({ fechaCierre: '2026-09-05', fechaProximoCierre: null }, '2026-09-06').estado)
      .toBe('sin_fecha')
  })

  it('recorta el progreso del ciclo actual si hoy es anterior al ciclo derivado', () => {
    expect(estadoCiclo({ fechaCierre: '2026-09-05', fechaProximoCierre: null }, '2026-06-01'))
      .toMatchObject({ estado: 'por_cerrar', progreso: 0 })
  })

  it('una fechaCierre inválida no habilita el ciclo actual', () => {
    expect(estadoCiclo({ fechaCierre: 'mañana', fechaProximoCierre: null }, '2026-09-03').estado)
      .toBe('sin_fecha')
  })

  it('con el cierre por venir gana por_cerrar aunque el próximo cierre esté cargado', () => {
    // El caso real: cierre 06/09 y próximo 06/10. Antes decía "faltan 32 días · 0%" — los 32
    // días eran al cierre de octubre y el 0% el del ciclo que ni arrancó. Lo accionable es que
    // el resumen de septiembre cierra en 2 días, con el ciclo actual (06/08 → 06/09) al 29/31.
    const r = estadoCiclo({ fechaCierre: '2026-09-06', fechaProximoCierre: '2026-10-06' }, '2026-09-04')
    expect(r.estado).toBe('por_cerrar')
    expect(r.dias).toBe(2)
    expect(r.progreso).toBeCloseTo(29 / 31)
  })

  it('pasada la fechaCierre vuelve a medir el ciclo que viene', () => {
    // Un día después del cierre: el evento por delante ya es el próximo cierre.
    expect(estadoCiclo({ fechaCierre: '2026-09-06', fechaProximoCierre: '2026-10-06' }, '2026-09-07'))
      .toMatchObject({ estado: 'abierto', dias: 29 })
  })

  it('por_cerrar gana también sobre cerrado si las fechas están invertidas', () => {
    // Dato inconsistente (próximo cierre anterior al cierre): decir "ya cerró" cuando el cierre
    // del período todavía no llegó es peor que medir el ciclo actual.
    expect(estadoCiclo({ fechaCierre: '2026-09-06', fechaProximoCierre: '2026-08-01' }, '2026-09-04').estado)
      .toBe('por_cerrar')
  })

  it('sin fechaCierre hay días pero no progreso (cierre incompleto)', () => {
    expect(estadoCiclo({ fechaCierre: null, fechaProximoCierre: '2026-09-09' }, '2026-08-25'))
      .toEqual({ estado: 'abierto', dias: 15, progreso: null })
  })

  it('un intervalo inválido no genera barra', () => {
    // Con la fechaCierre ya pasada, para que el caso llegue al ciclo fechaCierre → próximo.
    expect(estadoCiclo({ fechaCierre: '2026-09-09', fechaProximoCierre: '2026-09-09' }, '2026-09-20').progreso).toBeNull()
    expect(estadoCiclo({ fechaCierre: '2026-10-09', fechaProximoCierre: '2026-09-09' }, '2026-11-01').progreso).toBeNull()
  })

  it('recorta el progreso a [0, 1] si hoy cae fuera del ciclo', () => {
    expect(estadoCiclo(ciclo, '2026-12-01').progreso).toBe(1)
  })

  it('una fecha con formato inválido no rompe', () => {
    expect(estadoCiclo({ fechaCierre: '2026-08-10', fechaProximoCierre: 'ayer' }, '2026-08-25').estado).toBe('sin_fecha')
  })
})
