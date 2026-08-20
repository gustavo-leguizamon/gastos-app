import { describe, it, expect } from 'vitest'
import { computeResumen, type ResumenSettings } from './resumen-compute'

const SETTINGS_DEFAULT: ResumenSettings = {
  estimMesesAtras: 0,
  estimMissingBehavior: 'zero',
  estimIncluirCuotasVigentes: false,
  estimExcluirUltimaCuota: false,
}

// Gasto con includes mínimos para el resumen (pagos + items). El match del estimado es por
// `conceptoId`: usar el mismo número en distintos meses representa "el mismo concepto".
function makeGasto(overrides: Record<string, any> = {}) {
  return {
    conceptoId: 1,
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
          { conceptoId: 10, monto: 200, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: null },
          { conceptoId: 11, monto: 50, incluyeEnTotal: false, incluyeEnVencimiento: false, fecha: null },
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
          { conceptoId: 20, monto: 100, incluyeEnTotal: true, incluyeEnVencimiento: true, fecha: TODAY },
          { conceptoId: 21, monto: 999, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: TODAY },
          { conceptoId: 22, monto: 999, incluyeEnTotal: true, incluyeEnVencimiento: true, fecha: '2026-06-11' },
        ],
      })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.pagar_hoy).toBe(100)
  })

  it('resumen de tarjeta: vence por su propia fechaVencimiento aunque tenga consumos propagados', () => {
    const r = computeResumen(
      [makeGasto({
        esTarjeta: true,
        totalMoneda: 1000,
        fechaVencimiento: TODAY,
        pagos: [{ monto: 300 }],
        // Los consumos propagados siempre vienen con incluyeEnVencimiento: false.
        items: [
          { conceptoId: 30, monto: 600, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: '2026-06-02' },
          { conceptoId: 31, monto: 400, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: '2026-06-05' },
        ],
      })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.pagar_hoy).toBe(700)
  })

  it('resumen de tarjeta con vencimiento en otra fecha no cuenta', () => {
    const r = computeResumen(
      [makeGasto({
        esTarjeta: true,
        totalMoneda: 1000,
        fechaVencimiento: '2026-06-11',
        items: [{ conceptoId: 30, monto: 1000, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: TODAY }],
      })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.pagar_hoy).toBe(0)
  })
})

describe('computeResumen — total_vencido', () => {
  it('cuenta el restante de un gasto cuya fecha ya pasó', () => {
    const r = computeResumen(
      [makeGasto({ totalMoneda: 1000, fechaVencimiento: '2026-06-05', pagos: [{ monto: 300 }] })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.total_vencido).toBe(700)
  })

  it('no cuenta lo que vence hoy (eso es pagar_hoy) ni lo que vence más adelante', () => {
    const r = computeResumen(
      [
        makeGasto({ totalMoneda: 1000, fechaVencimiento: TODAY }),
        makeGasto({ totalMoneda: 500, fechaVencimiento: '2026-06-20' }),
      ],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.total_vencido).toBe(0)
    expect(r.pagar_hoy).toBe(1000)
  })

  it('un gasto vencido pero saldado no cuenta', () => {
    const r = computeResumen(
      [makeGasto({ totalMoneda: 1000, fechaVencimiento: '2026-06-05', pagos: [{ monto: 1000 }] })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.total_vencido).toBe(0)
  })

  it('resumen de tarjeta vencido cuenta por su propio total, no por sus consumos', () => {
    const r = computeResumen(
      [makeGasto({
        esTarjeta: true,
        totalMoneda: 1000,
        fechaVencimiento: '2026-06-01',
        items: [{ conceptoId: 30, monto: 600, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: '2026-05-20' }],
      })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.total_vencido).toBe(1000)
  })

  it('sub-items pasados cuentan sólo si el gasto padre sigue con saldo', () => {
    const items = [
      { conceptoId: 20, monto: 100, incluyeEnTotal: true, incluyeEnVencimiento: true, fecha: '2026-06-01' },
      { conceptoId: 21, monto: 900, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: '2026-06-01' },
    ]
    const conSaldo = computeResumen(
      [makeGasto({ totalMoneda: 1000, fechaVencimiento: TODAY, items })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(conSaldo.total_vencido).toBe(100)

    const saldado = computeResumen(
      [makeGasto({ totalMoneda: 1000, fechaVencimiento: TODAY, items, pagos: [{ monto: 1000 }] })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(saldado.total_vencido).toBe(0)
  })
})

describe('computeResumen — estimado próximo mes', () => {
  it('sin meses previos: el estimado es el monto del mes actual', () => {
    const r = computeResumen(
      [makeGasto({ conceptoId: 100, totalMoneda: 1000, tipoCambio: 1 })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.total_proximo_mes).toBe(1000)
  })

  it('promedia con meses previos (missingBehavior=zero suma 0 si no matchea)', () => {
    const settings = { ...SETTINGS_DEFAULT, estimMesesAtras: 1 }
    const r = computeResumen(
      [makeGasto({ conceptoId: 100, totalMoneda: 1000, tipoCambio: 1 })],
      [[makeGasto({ conceptoId: 100, totalMoneda: 500, tipoCambio: 1 })]],
      settings, TODAY,
    )
    expect(r.total_proximo_mes).toBe(750) // (1000 + 500) / 2
  })

  it('missingBehavior=zero penaliza un gasto que no existía el mes previo', () => {
    const settings = { ...SETTINGS_DEFAULT, estimMesesAtras: 1, estimMissingBehavior: 'zero' }
    const r = computeResumen(
      [makeGasto({ conceptoId: 100, totalMoneda: 1000, tipoCambio: 1 })],
      [[makeGasto({ conceptoId: 200, totalMoneda: 500 })]],
      settings, TODAY,
    )
    expect(r.total_proximo_mes).toBe(500) // (1000 + 0) / 2
  })

  it('missingBehavior=average_found ignora meses sin match', () => {
    const settings = { ...SETTINGS_DEFAULT, estimMesesAtras: 1, estimMissingBehavior: 'average_found' }
    const r = computeResumen(
      [makeGasto({ conceptoId: 100, totalMoneda: 1000, tipoCambio: 1 })],
      [[makeGasto({ conceptoId: 200, totalMoneda: 500 })]],
      settings, TODAY,
    )
    expect(r.total_proximo_mes).toBe(1000) // sólo el valor actual
  })

  it('estimIncluirCuotasVigentes usa el monto tal cual para gastos con cuotas', () => {
    const settings = { ...SETTINGS_DEFAULT, estimMesesAtras: 1, estimIncluirCuotasVigentes: true }
    const r = computeResumen(
      [makeGasto({ conceptoId: 100, totalMoneda: 1200, tipoCambio: 1, cuotaActual: 2, cuotasTotales: 6 })],
      [[makeGasto({ conceptoId: 100, totalMoneda: 1, tipoCambio: 1 })]], // no debe promediar
      settings, TODAY,
    )
    expect(r.total_proximo_mes).toBe(1200)
  })

  it('estimExcluirUltimaCuota descarta el gasto cuando es la última cuota', () => {
    const settings = { ...SETTINGS_DEFAULT, estimExcluirUltimaCuota: true, estimIncluirCuotasVigentes: true }
    const r = computeResumen(
      [makeGasto({ conceptoId: 100, totalMoneda: 1200, cuotaActual: 6, cuotasTotales: 6 })],
      [], settings, TODAY,
    )
    expect(r.total_proximo_mes).toBe(0)
  })

  it('agrupa sub-items del mismo gasto por concepto', () => {
    const r = computeResumen(
      [makeGasto({
        conceptoId: 1,
        items: [
          { conceptoId: 5, monto: 100, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: null },
          { conceptoId: 5, monto: 50, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: null },
        ],
      })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    // Ambos items comparten conceptoId 5 → se agrupan → 150 en el estimado
    expect(r.total_proximo_mes).toBe(150)
  })
})

describe('computeResumen — ingresos y ahorro', () => {
  // Ingreso en ARS: el tipo de cambio es 1 y el monto no se convierte.
  const ingresoArs = (monto: number) => ({ montoMoneda: monto, tipoCambio: 1 })

  it('total_debito suma los gastos en débito estén pagados o no', () => {
    const r = computeResumen(
      [
        makeGasto({ totalMoneda: 800, tipoPago: 'D', pagos: [] }),        // sin pagar → cuenta igual
        makeGasto({ totalMoneda: 200, tipoPago: 'D', pagos: [{ monto: 200 }] }),
      ],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.total_debito).toBe(1000)
  })

  it('total_debito excluye los consumos de crédito (ya están en el resumen de tarjeta)', () => {
    const r = computeResumen(
      [
        makeGasto({ totalMoneda: 5000, tipoPago: 'C' }),                          // consumo de crédito
        makeGasto({ totalMoneda: 5000, tipoPago: 'D', esTarjeta: true }),         // resumen de la tarjeta
        makeGasto({ totalMoneda: 300, tipoPago: 'D' }),                           // débito común
      ],
      [], SETTINGS_DEFAULT, TODAY,
    )
    // Sólo el resumen de tarjeta + el débito: el consumo de crédito no se cuenta dos veces.
    expect(r.total_debito).toBe(5300)
  })

  it('ahorra contra lo gastado en débito, no contra lo pagado ni contra el total de gastos', () => {
    const r = computeResumen(
      [
        makeGasto({ totalMoneda: 400, tipoPago: 'D', pagos: [{ monto: 100 }] }),
        makeGasto({ totalMoneda: 5000, tipoPago: 'C' }),                          // crédito: no resta
      ],
      [], SETTINGS_DEFAULT, TODAY,
      [ingresoArs(600), ingresoArs(400)],
    )
    expect(r.total_ingresos).toBe(1000)
    expect(r.total_debito).toBe(400)
    // 1000 − 400 débito (no − 100 pagado, no − 5400 total de gastos)
    expect(r.total_ahorro).toBe(600)
    expect(r.ahorro_pct).toBe(60)
  })

  it('sin ingresos cargados el ahorro es el débito en negativo y el % es 0', () => {
    const r = computeResumen(
      [makeGasto({ totalMoneda: 250, tipoPago: 'D' })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.total_ingresos).toBe(0)
    expect(r.total_ahorro).toBe(-250)
    expect(r.ahorro_pct).toBe(0)
  })

  it('el ahorro queda negativo cuando se gastó en débito más de lo que entró', () => {
    const r = computeResumen(
      [makeGasto({ totalMoneda: 1500, tipoPago: 'D' })],
      [], SETTINGS_DEFAULT, TODAY,
      [ingresoArs(1000)],
    )
    expect(r.total_ahorro).toBe(-500)
    expect(r.ahorro_pct).toBe(-50)
  })

  it('convierte a ARS los ingresos en otra moneda antes de comparar', () => {
    const r = computeResumen(
      [makeGasto({ totalMoneda: 350, tipoPago: 'D' })],
      [], SETTINGS_DEFAULT, TODAY,
      [{ montoMoneda: 1, tipoCambio: 1350 }, ingresoArs(50)],
    )
    expect(r.total_ingresos).toBe(1400)
    expect(r.total_ahorro).toBe(1050)
  })

  it('en débito no confirmado usa la suma de sub-items, igual que el resto de los totales', () => {
    const r = computeResumen(
      [makeGasto({
        tipoPago: 'D',
        confirmado: false,
        totalMoneda: 9999,
        items: [
          { conceptoId: 5, monto: 120, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: null },
          { conceptoId: 6, monto: 80, incluyeEnTotal: false, incluyeEnVencimiento: false, fecha: null },
        ],
      })],
      [], SETTINGS_DEFAULT, TODAY,
      [ingresoArs(1000)],
    )
    expect(r.total_debito).toBe(120)
    expect(r.total_ahorro).toBe(880)
  })
})
