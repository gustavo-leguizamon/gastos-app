import { describe, it, expect } from 'vitest'
import { computeResumen, type ResumenSettings } from './resumen-compute'

const SETTINGS_DEFAULT: ResumenSettings = {
  estimMesesAtras: 0,
  estimMissingBehavior: 'zero',
  estimIncluirCuotasVigentes: false,
  estimExcluirUltimaCuota: false,
}

// Gasto con includes mínimos para el resumen (pagos + items).
function makeGasto(overrides: Record<string, any> = {}) {
  return {
    descripcion: 'Gasto',
    tipoPago: 'D',
    tipoCambio: 1,
    totalMoneda: 1000,
    pasajeMesSiguiente: 0,
    prestamo_a_otro: 0,
    cuotaActual: null,
    cuotasTotales: null,
    fechaVencimiento: '2026-06-10',
    confirmado: true,
    pagos: [],
    items: [],
    ...overrides,
  }
}

const TODAY = '2026-06-10'

describe('computeResumen — agregados básicos', () => {
  it('suma total_gastos usando totalMoneda * tipoCambio para gastos confirmados', () => {
    const r = computeResumen(
      [makeGasto({ totalMoneda: 1000, tipoCambio: 1 }), makeGasto({ totalMoneda: 100, tipoCambio: 1.5 })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.total_gastos).toBe(1150)
  })

  it('total_pagado y total_restante reflejan los pagos', () => {
    const r = computeResumen(
      [makeGasto({ totalMoneda: 1000, pagos: [{ monto: 400 }] })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.total_pagado).toBe(400)
    expect(r.total_restante).toBe(600)
  })

  it('total_tarjetas suma sólo gastos tipo C sin préstamo', () => {
    const r = computeResumen(
      [
        makeGasto({ totalMoneda: 1000, tipoPago: 'C', prestamo_a_otro: 0 }),
        makeGasto({ totalMoneda: 500, tipoPago: 'C', prestamo_a_otro: 200 }), // préstamo → excluido
        makeGasto({ totalMoneda: 300, tipoPago: 'D' }),                        // débito → excluido
      ],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.total_tarjetas).toBe(1000)
  })

  it('total_prestamos y total_pasajes se acumulan; neto descuenta préstamos, tarjetas y pasajes', () => {
    const r = computeResumen(
      [makeGasto({ totalMoneda: 1000, tipoPago: 'C', prestamo_a_otro: 0, pasajeMesSiguiente: 100 })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    // total_gastos 1000, tarjetas 1000, pasajes 100 → neto = 1000 - 0 - 1000 - 100 = -100
    expect(r.total_pasajes).toBe(100)
    expect(r.total_gastos_neto).toBe(-100)
    expect(r.total_restante_neto).toBe(r.total_restante - 100)
  })
})

describe('computeResumen — gastos no confirmados', () => {
  it('ignora gastos no confirmados sin items', () => {
    const r = computeResumen(
      [makeGasto({ totalMoneda: 9999, confirmado: false, items: [] })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.total_gastos).toBe(0)
  })

  it('para no confirmados con items usa la suma de items con incluyeEnTotal', () => {
    const r = computeResumen(
      [makeGasto({
        confirmado: false,
        totalMoneda: 9999, // se ignora porque no está confirmado
        items: [
          { descripcion: 'a', monto: 200, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: null },
          { descripcion: 'b', monto: 50, incluyeEnTotal: false, incluyeEnVencimiento: false, fecha: null },
        ],
      })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.total_gastos).toBe(200)
  })
})

describe('computeResumen — pagar_hoy', () => {
  it('gasto sin items vence por fechaVencimiento === today (cuenta el restante)', () => {
    const r = computeResumen(
      [
        makeGasto({ totalMoneda: 1000, fechaVencimiento: TODAY, pagos: [{ monto: 300 }] }),
        makeGasto({ totalMoneda: 500, fechaVencimiento: '2026-06-11' }), // otra fecha → no cuenta
      ],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.pagar_hoy).toBe(700)
  })

  it('gasto con items: sólo items con incluyeEnVencimiento y fecha === today', () => {
    const r = computeResumen(
      [makeGasto({
        fechaVencimiento: TODAY, // se ignora porque tiene items
        items: [
          { descripcion: 'hoy-cuenta', monto: 100, incluyeEnTotal: true, incluyeEnVencimiento: true, fecha: TODAY },
          { descripcion: 'hoy-no-venc', monto: 999, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: TODAY },
          { descripcion: 'otra-fecha', monto: 999, incluyeEnTotal: true, incluyeEnVencimiento: true, fecha: '2026-06-11' },
        ],
      })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.pagar_hoy).toBe(100)
  })
})

describe('computeResumen — estimado próximo mes', () => {
  it('sin meses previos: el estimado es el monto del mes actual', () => {
    const r = computeResumen(
      [makeGasto({ descripcion: 'Luz', totalMoneda: 1000, tipoCambio: 1 })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.total_proximo_mes).toBe(1000)
  })

  it('promedia con meses previos (missingBehavior=zero suma 0 si no matchea)', () => {
    const settings = { ...SETTINGS_DEFAULT, estimMesesAtras: 1 }
    const r = computeResumen(
      [makeGasto({ descripcion: 'Luz', totalMoneda: 1000, tipoCambio: 1 })],
      [[makeGasto({ descripcion: 'Luz', totalMoneda: 500, tipoCambio: 1 })]],
      settings, TODAY,
    )
    expect(r.total_proximo_mes).toBe(750) // (1000 + 500) / 2
  })

  it('missingBehavior=zero penaliza un gasto que no existía el mes previo', () => {
    const settings = { ...SETTINGS_DEFAULT, estimMesesAtras: 1, estimMissingBehavior: 'zero' }
    const r = computeResumen(
      [makeGasto({ descripcion: 'Nuevo', totalMoneda: 1000, tipoCambio: 1 })],
      [[makeGasto({ descripcion: 'Otro', totalMoneda: 500 })]],
      settings, TODAY,
    )
    expect(r.total_proximo_mes).toBe(500) // (1000 + 0) / 2
  })

  it('missingBehavior=average_found ignora meses sin match', () => {
    const settings = { ...SETTINGS_DEFAULT, estimMesesAtras: 1, estimMissingBehavior: 'average_found' }
    const r = computeResumen(
      [makeGasto({ descripcion: 'Nuevo', totalMoneda: 1000, tipoCambio: 1 })],
      [[makeGasto({ descripcion: 'Otro', totalMoneda: 500 })]],
      settings, TODAY,
    )
    expect(r.total_proximo_mes).toBe(1000) // sólo el valor actual
  })

  it('estimIncluirCuotasVigentes usa el monto tal cual para gastos con cuotas', () => {
    const settings = { ...SETTINGS_DEFAULT, estimMesesAtras: 1, estimIncluirCuotasVigentes: true }
    const r = computeResumen(
      [makeGasto({ descripcion: 'TV', totalMoneda: 1200, tipoCambio: 1, cuotaActual: 2, cuotasTotales: 6 })],
      [[makeGasto({ descripcion: 'TV', totalMoneda: 1, tipoCambio: 1 })]], // no debe promediar
      settings, TODAY,
    )
    expect(r.total_proximo_mes).toBe(1200)
  })

  it('estimExcluirUltimaCuota descarta el gasto cuando es la última cuota', () => {
    const settings = { ...SETTINGS_DEFAULT, estimExcluirUltimaCuota: true, estimIncluirCuotasVigentes: true }
    const r = computeResumen(
      [makeGasto({ descripcion: 'TV', totalMoneda: 1200, cuotaActual: 6, cuotasTotales: 6 })],
      [], settings, TODAY,
    )
    expect(r.total_proximo_mes).toBe(0)
  })

  it('agrupa sub-items del mismo gasto por descripción normalizada', () => {
    const r = computeResumen(
      [makeGasto({
        descripcion: 'Super',
        items: [
          { descripcion: 'Carne', monto: 100, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: null },
          { descripcion: ' carne ', monto: 50, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: null },
        ],
      })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    // Ambos items "carne" se agrupan → 150 en el estimado
    expect(r.total_proximo_mes).toBe(150)
  })
})
