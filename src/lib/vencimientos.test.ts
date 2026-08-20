import { describe, it, expect } from 'vitest'
import { vencePorGasto, vencimientosDelDia, vencimientosPendientes, sumVencimientos } from './vencimientos'
import type { GastoVencimientoLike, ItemVencimientoLike } from './vencimientos'

const HOY = '2026-08-14'

function gasto(over: Partial<GastoVencimientoLike> = {}): GastoVencimientoLike {
  return {
    id: 1,
    descripcion: 'Luz',
    casa_nombre: 'Casa',
    fecha_vencimiento: HOY,
    total_ars: 1000,
    total_pagado: 0,
    confirmado: true,
    es_tarjeta: false,
    items: [],
    ...over,
  }
}

function item(over: Partial<ItemVencimientoLike> = {}): ItemVencimientoLike {
  return {
    id: 10,
    descripcion: 'Sub',
    monto: 300,
    fecha: HOY,
    incluye_en_total: true,
    incluye_en_vencimiento: true,
    ...over,
  }
}

describe('vencePorGasto', () => {
  it('gasto sin sub-items vence por sí mismo', () => {
    expect(vencePorGasto(false, 0)).toBe(true)
  })

  it('gasto normal con sub-items vence por los sub-items marcados', () => {
    expect(vencePorGasto(false, 3)).toBe(false)
  })

  it('resumen de tarjeta vence por sí mismo aunque tenga consumos propagados', () => {
    expect(vencePorGasto(true, 5)).toBe(true)
  })

  it('trata esTarjeta ausente como false', () => {
    expect(vencePorGasto(undefined, 2)).toBe(false)
    expect(vencePorGasto(null, 0)).toBe(true)
  })
})

describe('vencimientosDelDia', () => {
  it('devuelve el restante del gasto que vence hoy', () => {
    const out = vencimientosDelDia([gasto({ total_pagado: 400 })], HOY)
    expect(out).toEqual([
      { key: 'g-1', tipo: 'gasto', descripcion: 'Luz', casa_nombre: 'Casa', monto: 600, estado: 'hoy', fecha: HOY, dias_atraso: 0 },
    ])
  })

  it('ignora gastos que vencen otro día', () => {
    expect(vencimientosDelDia([gasto({ fecha_vencimiento: '2026-08-15' })], HOY)).toEqual([])
  })

  it('ignora gastos ya saldados (restante 0 o negativo)', () => {
    expect(vencimientosDelDia([gasto({ total_pagado: 1000 })], HOY)).toEqual([])
    expect(vencimientosDelDia([gasto({ total_pagado: 1200 })], HOY)).toEqual([])
  })

  it('sin confirmar y sin sub-items no se cuenta (no hay monto confiable)', () => {
    expect(vencimientosDelDia([gasto({ confirmado: false })], HOY)).toEqual([])
  })

  it('sin confirmar toma el total de los sub-items que incluyen en total', () => {
    const out = vencimientosDelDia([gasto({
      confirmado: false,
      es_tarjeta: true, // vence por sí mismo aunque tenga sub-items
      total_ars: 99999,
      items: [
        item({ id: 11, monto: 700, incluye_en_vencimiento: false }),
        item({ id: 12, monto: 500, incluye_en_total: false, incluye_en_vencimiento: false }),
      ],
    })], HOY)
    expect(out).toHaveLength(1)
    expect(out[0].monto).toBe(700)
  })

  it('con sub-items sólo cuenta los marcados incluye_en_vencimiento con fecha de hoy', () => {
    const out = vencimientosDelDia([gasto({
      items: [
        item({ id: 11, descripcion: 'Cuota', monto: 300 }),
        item({ id: 12, descripcion: 'Otro', monto: 400, incluye_en_vencimiento: false }),
        item({ id: 13, descripcion: 'Mañana', monto: 500, fecha: '2026-08-15' }),
      ],
    })], HOY)
    expect(out).toEqual([
      { key: 'i-11', tipo: 'subitem', descripcion: 'Cuota', parent: 'Luz', casa_nombre: 'Casa', monto: 300, estado: 'hoy', fecha: HOY, dias_atraso: 0 },
    ])
  })

  it('el gasto con sub-items no aporta su propio vencimiento', () => {
    // fecha_vencimiento es hoy, pero ningún sub-item vence hoy → nada.
    const out = vencimientosDelDia([gasto({
      items: [item({ fecha: '2026-08-20' })],
    })], HOY)
    expect(out).toEqual([])
  })

  it('el resumen de tarjeta vence por sí mismo, no por sus consumos propagados', () => {
    const out = vencimientosDelDia([gasto({
      id: 7,
      descripcion: 'Visa',
      es_tarjeta: true,
      total_ars: 5000,
      items: [item({ id: 20, monto: 5000, incluye_en_vencimiento: false })],
    })], HOY)
    expect(out).toEqual([
      { key: 'g-7', tipo: 'gasto', descripcion: 'Visa', casa_nombre: 'Casa', monto: 5000, estado: 'hoy', fecha: HOY, dias_atraso: 0 },
    ])
  })

  it('redondea el restante a dos decimales', () => {
    const out = vencimientosDelDia([gasto({ total_ars: 100.1, total_pagado: 0.2 })], HOY)
    expect(out[0].monto).toBe(99.9)
  })

  it('tolera lista vacía y sub-items nulos', () => {
    expect(vencimientosDelDia([], HOY)).toEqual([])
    expect(vencimientosDelDia(null, HOY)).toEqual([])
    expect(vencimientosDelDia([gasto({ items: null })], HOY)).toHaveLength(1)
  })
})

describe('vencimientosPendientes', () => {
  it('marca como vencido lo que ya pasó de fecha y sigue impago', () => {
    const out = vencimientosPendientes([gasto({ fecha_vencimiento: '2026-08-10' })], HOY)
    expect(out).toHaveLength(1)
    expect(out[0].estado).toBe('vencido')
    expect(out[0].dias_atraso).toBe(4)
    expect(out[0].monto).toBe(1000)
  })

  it('lo de hoy queda con estado hoy y sin atraso', () => {
    const out = vencimientosPendientes([gasto()], HOY)
    expect(out[0].estado).toBe('hoy')
    expect(out[0].dias_atraso).toBe(0)
  })

  it('no incluye lo que todavía no venció', () => {
    expect(vencimientosPendientes([gasto({ fecha_vencimiento: '2026-08-20' })], HOY)).toEqual([])
  })

  it('un gasto vencido pero saldado no aparece', () => {
    const out = vencimientosPendientes(
      [gasto({ fecha_vencimiento: '2026-08-01', total_pagado: 1000 })],
      HOY,
    )
    expect(out).toEqual([])
  })

  it('ordena del más viejo al más nuevo', () => {
    const out = vencimientosPendientes(
      [
        gasto({ id: 1, fecha_vencimiento: HOY }),
        gasto({ id: 2, fecha_vencimiento: '2026-08-01' }),
        gasto({ id: 3, fecha_vencimiento: '2026-08-10' }),
      ],
      HOY,
    )
    expect(out.map(v => v.fecha)).toEqual(['2026-08-01', '2026-08-10', HOY])
  })

  it('sub-item pasado cuenta si el gasto padre sigue con saldo', () => {
    const out = vencimientosPendientes(
      [gasto({ total_ars: 1000, items: [item({ fecha: '2026-08-05', monto: 300 })] })],
      HOY,
    )
    expect(out).toHaveLength(1)
    expect(out[0].tipo).toBe('subitem')
    expect(out[0].estado).toBe('vencido')
    expect(out[0].dias_atraso).toBe(9)
  })

  it('sub-item pasado NO cuenta si el gasto padre ya está saldado', () => {
    const out = vencimientosPendientes(
      [gasto({ total_ars: 1000, total_pagado: 1000, items: [item({ fecha: '2026-08-05' })] })],
      HOY,
    )
    expect(out).toEqual([])
  })

  it('sub-item de hoy cuenta aunque el padre esté saldado (comportamiento histórico)', () => {
    const out = vencimientosPendientes(
      [gasto({ total_ars: 1000, total_pagado: 1000, items: [item({ fecha: HOY })] })],
      HOY,
    )
    expect(out).toHaveLength(1)
    expect(out[0].estado).toBe('hoy')
  })

  it('sub-item sin fecha se ignora', () => {
    expect(vencimientosPendientes([gasto({ items: [item({ fecha: null })] })], HOY)).toEqual([])
  })

  it('vencimientosDelDia sigue devolviendo sólo los de hoy', () => {
    const gastos = [
      gasto({ id: 1, fecha_vencimiento: HOY }),
      gasto({ id: 2, fecha_vencimiento: '2026-08-01' }),
    ]
    expect(vencimientosDelDia(gastos, HOY)).toHaveLength(1)
    expect(vencimientosPendientes(gastos, HOY)).toHaveLength(2)
  })
})

describe('sumVencimientos', () => {
  it('suma los montos y redondea a dos decimales', () => {
    const out = vencimientosPendientes(
      [gasto({ id: 1, total_ars: 100.111 }), gasto({ id: 2, total_ars: 200.222 })],
      HOY,
    )
    expect(sumVencimientos(out)).toBe(300.33)
  })

  it('lista vacía suma 0', () => {
    expect(sumVencimientos([])).toBe(0)
  })
})
