import { describe, it, expect } from 'vitest'
import {
  computeMovimientos,
  resumenInversion,
  serieEvolucion,
  parseMonedaId,
  toInversionResponse,
  parseDescripcionMovimiento,
  toMovimientoResponse,
} from './inversiones-compute'
import type { Movimiento } from './types'

function mov(over: Partial<Movimiento> = {}): Movimiento {
  return {
    id: 1,
    inversion_id: 1,
    fecha: '2026-01-01',
    monto_actual: 1000,
    movimiento: 0,
    descripcion: null,
    created_at: '',
    ...over,
  }
}

describe('computeMovimientos', () => {
  it('la primera fila no tiene con qué comparar', () => {
    const [m] = computeMovimientos([mov()])
    expect(m.monto_actualizado).toBe(1000)
    expect(m.cambio).toBeNull()
    expect(m.ganancia).toBeNull()
    expect(m.rendimiento_pct).toBeNull()
  })

  it('monto_actualizado suma el movimiento al saldo', () => {
    const [m] = computeMovimientos([mov({ monto_actual: 1000, movimiento: 500 })])
    expect(m.monto_actualizado).toBe(1500)
  })

  it('cambio es la diferencia de saldo contra la fila previa', () => {
    const [, b] = computeMovimientos([
      mov({ id: 1, monto_actual: 1000 }),
      mov({ id: 2, monto_actual: 1200 }),
    ])
    expect(b.cambio).toBe(200)
  })

  it('un aporte no cuenta como ganancia (la distinción que faltaba)', () => {
    const [, b] = computeMovimientos([
      mov({ id: 1, monto_actual: 1000 }),
      mov({ id: 2, monto_actual: 1000, movimiento: 1000 }),
    ])
    expect(b.cambio).toBe(1000)   // el saldo subió 1000...
    expect(b.ganancia).toBe(0)    // ...pero la inversión no rindió nada
    expect(b.rendimiento_pct).toBe(0)
  })

  it('separa la ganancia del aporte cuando hay de los dos', () => {
    // Saldo previo 1000; se aportan 500 y el saldo termina en 1700 → 200 de ganancia.
    const [, b] = computeMovimientos([
      mov({ id: 1, monto_actual: 1000 }),
      mov({ id: 2, monto_actual: 1200, movimiento: 500 }),
    ])
    expect(b.monto_actualizado).toBe(1700)
    expect(b.cambio).toBe(700)
    expect(b.ganancia).toBe(200)
    expect(b.rendimiento_pct).toBe(20)
  })

  it('un retiro tampoco cuenta como pérdida', () => {
    const [, b] = computeMovimientos([
      mov({ id: 1, monto_actual: 1000 }),
      mov({ id: 2, monto_actual: 1000, movimiento: -300 }),
    ])
    expect(b.cambio).toBe(-300)
    expect(b.ganancia).toBe(0)
  })

  it('la pérdida real da ganancia negativa', () => {
    const [, b] = computeMovimientos([
      mov({ id: 1, monto_actual: 1000 }),
      mov({ id: 2, monto_actual: 900 }),
    ])
    expect(b.ganancia).toBe(-100)
    expect(b.rendimiento_pct).toBe(-10)
  })

  it('un saldo previo en cero no divide por cero', () => {
    const [, b] = computeMovimientos([
      mov({ id: 1, monto_actual: 0 }),
      mov({ id: 2, monto_actual: 500 }),
    ])
    expect(b.ganancia).toBe(500)
    expect(b.rendimiento_pct).toBeNull()
  })

  it('redondea a dos decimales', () => {
    const [, b] = computeMovimientos([
      mov({ id: 1, monto_actual: 100.111 }),
      mov({ id: 2, monto_actual: 200.222 }),
    ])
    expect(b.monto_actualizado).toBe(200.22)
    expect(b.cambio).toBe(100.11)
  })

  it('lista vacía o nula devuelve vacío', () => {
    expect(computeMovimientos([])).toEqual([])
    expect(computeMovimientos(null as any)).toEqual([])
  })
})

describe('resumenInversion', () => {
  it('sin movimientos devuelve todo en cero', () => {
    expect(resumenInversion([])).toEqual({
      saldo_actual: 0, aportado: 0, ganancia_total: 0, rendimiento_pct: null, cantidad: 0,
    })
  })

  it('saldo actual es el del último movimiento', () => {
    const r = resumenInversion([
      mov({ id: 1, monto_actual: 1000 }),
      mov({ id: 2, monto_actual: 1500 }),
    ])
    expect(r.saldo_actual).toBe(1500)
    expect(r.cantidad).toBe(2)
  })

  it('suma los aportes y separa la ganancia', () => {
    const r = resumenInversion([
      mov({ id: 1, monto_actual: 1000 }),
      mov({ id: 2, monto_actual: 1200, movimiento: 500 }),  // +200 de ganancia
      mov({ id: 3, monto_actual: 1800 }),                    // +100 de ganancia
    ])
    expect(r.aportado).toBe(500)
    expect(r.ganancia_total).toBe(300)
  })

  it('el rendimiento se mide sobre el capital expuesto, no sobre el saldo final', () => {
    // Base = primer saldo (1000) + aportes posteriores (0) = 1000; ganancia 200 → 20%.
    // Dividir por el saldo final (1200) daría 16,7% y subestimaría el rendimiento.
    const r = resumenInversion([
      mov({ id: 1, monto_actual: 1000 }),
      mov({ id: 2, monto_actual: 1200 }),
    ])
    expect(r.rendimiento_pct).toBe(20)
  })

  it('los aportes posteriores entran en la base del rendimiento', () => {
    const r = resumenInversion([
      mov({ id: 1, monto_actual: 1000 }),
      mov({ id: 2, monto_actual: 1000, movimiento: 1000 }), // aporte puro, sin ganancia
    ])
    expect(r.ganancia_total).toBe(0)
    expect(r.rendimiento_pct).toBe(0)
  })

  it('una sola fila no tiene ganancia todavía', () => {
    const r = resumenInversion([mov({ monto_actual: 1000 })])
    expect(r.ganancia_total).toBe(0)
    expect(r.rendimiento_pct).toBe(0)
    expect(r.saldo_actual).toBe(1000)
  })

  it('base en cero devuelve rendimiento null', () => {
    const r = resumenInversion([
      mov({ id: 1, monto_actual: 0 }),
      mov({ id: 2, monto_actual: 0 }),
    ])
    expect(r.rendimiento_pct).toBeNull()
  })
})

describe('serieEvolucion', () => {
  it('un punto por movimiento, con el saldo ya actualizado', () => {
    const serie = serieEvolucion([
      mov({ id: 1, fecha: '2026-01-01', monto_actual: 1000 }),
      mov({ id: 2, fecha: '2026-02-01', monto_actual: 1000, movimiento: 200 }),
    ])
    expect(serie).toEqual([
      { fecha: '2026-01-01', saldo: 1000 },
      { fecha: '2026-02-01', saldo: 1200 },
    ])
  })

  it('sin movimientos la serie es vacía', () => {
    expect(serieEvolucion([])).toEqual([])
  })
})

describe('parseMonedaId', () => {
  it('acepta enteros positivos', () => {
    expect(parseMonedaId(3)).toBe(3)
    expect(parseMonedaId('3')).toBe(3)
  })

  it('todo lo demás es "sin moneda declarada"', () => {
    for (const v of [null, undefined, '', 0, -1, 1.5, 'x', {}]) {
      expect(parseMonedaId(v)).toBeNull()
    }
  })
})

describe('toInversionResponse', () => {
  it('mapea a snake_case con la moneda incluida', () => {
    const fecha = new Date('2026-01-01T00:00:00Z')
    expect(toInversionResponse({
      id: 1, nombre: 'Plazo fijo', monedaId: 2,
      moneda: { codigo: 'USD', simbolo: 'U$S' }, createdAt: fecha,
    })).toEqual({
      id: 1,
      nombre: 'Plazo fijo',
      moneda_id: 2,
      moneda_codigo: 'USD',
      moneda_simbolo: 'U$S',
      created_at: fecha.toISOString(),
    })
  })

  it('sin moneda deja los campos en null', () => {
    const r = toInversionResponse({ id: 1, nombre: 'X', monedaId: null, moneda: null, createdAt: new Date() })
    expect(r.moneda_id).toBeNull()
    expect(r.moneda_codigo).toBeNull()
  })
})

describe('parseDescripcionMovimiento', () => {
  it('trimea el texto', () => {
    expect(parseDescripcionMovimiento('  aporte mensual  ')).toBe('aporte mensual')
  })

  it('el string vacío (o de sólo espacios) es "no lo aclaró", no ""', () => {
    expect(parseDescripcionMovimiento('')).toBeNull()
    expect(parseDescripcionMovimiento('   ')).toBeNull()
  })

  it('lo que no es texto es null', () => {
    for (const v of [null, undefined, 0, 123, {}, []]) {
      expect(parseDescripcionMovimiento(v)).toBeNull()
    }
  })
})

describe('toMovimientoResponse', () => {
  it('mapea a snake_case con la descripción', () => {
    const fecha = new Date('2026-08-26T10:00:00Z')
    expect(toMovimientoResponse({
      id: 7, inversionId: 3, fecha: '2026-08-26', montoActual: 1500,
      movimiento: 500, descripcion: 'aporte mensual', createdAt: fecha,
    })).toEqual({
      id: 7,
      inversion_id: 3,
      fecha: '2026-08-26',
      monto_actual: 1500,
      movimiento: 500,
      descripcion: 'aporte mensual',
      created_at: fecha.toISOString(),
    })
  })

  it('un movimiento viejo sin descripción sale en null', () => {
    const r = toMovimientoResponse({
      id: 1, inversionId: 1, fecha: '2026-01-01', montoActual: 1000,
      movimiento: 0, descripcion: null, createdAt: new Date(),
    })
    expect(r.descripcion).toBeNull()
  })
})
