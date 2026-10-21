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

  it('total_tarjetas suma sólo gastos tipo C', () => {
    const r = computeResumen(
      [
        makeGasto({ totalMoneda: 1000, tipoPago: 'C' }),
        makeGasto({ totalMoneda: 500, tipoPago: 'C' }),
        makeGasto({ totalMoneda: 300, tipoPago: 'D' }), // débito → excluido
      ],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.total_tarjetas).toBe(1500)
  })

  it('una devolución (gasto negativo) resta de total_gastos y de total_tarjetas', () => {
    const r = computeResumen(
      [
        makeGasto({ totalMoneda: 1000, tipoPago: 'C' }),
        makeGasto({ totalMoneda: -200, tipoPago: 'C' }), // devolución de un préstamo
      ],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.total_gastos).toBe(800)
    expect(r.total_tarjetas).toBe(800)
    expect(r).not.toHaveProperty('total_prestamos')
  })

  it('total_pasajes se acumula; neto descuenta tarjetas y pasajes', () => {
    const r = computeResumen(
      [makeGasto({ totalMoneda: 1000, tipoPago: 'C', pasajeMesSiguiente: 100 })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    // total_gastos 1000, tarjetas 1000, pasajes 100 → neto = 1000 - 1000 - 100 = -100
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

describe('computeResumen — detalle del estimado próximo mes', () => {
  const PREV = [{ mes: 5, anio: 2026 }, { mes: 4, anio: 2026 }]

  it('una fila por unidad con su histórico rotulado y el estimado que aportó', () => {
    const settings = { ...SETTINGS_DEFAULT, estimMesesAtras: 2, estimMissingBehavior: 'zero' }
    const r = computeResumen(
      [makeGasto({ id: 7, conceptoId: 100, concepto: { nombre: 'Luz' }, totalMoneda: 900 })],
      [[makeGasto({ conceptoId: 100, totalMoneda: 600 })], []],
      settings, TODAY, [], PREV,
    )
    expect(r.detalle_proximo_mes).toEqual([{
      gasto_ids: [7],
      cantidad: 1,
      concepto_id: 100,
      descripcion: 'Luz',
      gasto_padre: null,
      es_subitem: false,
      cuota_actual: null,
      cuotas_totales: null,
      monto_actual: 900,
      criterio: 'promedio',
      historico: [
        { mes: 5, anio: 2026, monto: 600, en_promedio: true },
        // Sin match + missingBehavior=zero → entra al promedio como 0
        { mes: 4, anio: 2026, monto: null, en_promedio: true },
      ],
      estimado: 500, // (900 + 600 + 0) / 3
    }])
  })

  it('con average_found el mes sin match queda fuera del promedio', () => {
    const settings = { ...SETTINGS_DEFAULT, estimMesesAtras: 1, estimMissingBehavior: 'average_found' }
    const r = computeResumen(
      [makeGasto({ conceptoId: 100, totalMoneda: 900 })],
      [[]], settings, TODAY, [], PREV.slice(0, 1),
    )
    expect(r.detalle_proximo_mes[0].historico).toEqual([{ mes: 5, anio: 2026, monto: null, en_promedio: false }])
    expect(r.detalle_proximo_mes[0].estimado).toBe(900)
  })

  it('marca el criterio de cuotas: vigente suma directo, última aporta 0 pero se lista', () => {
    const settings = { ...SETTINGS_DEFAULT, estimIncluirCuotasVigentes: true, estimExcluirUltimaCuota: true }
    const r = computeResumen(
      [
        makeGasto({ conceptoId: 1, totalMoneda: 300, cuotaActual: 2, cuotasTotales: 6 }),
        makeGasto({ conceptoId: 2, totalMoneda: 400, cuotaActual: 6, cuotasTotales: 6 }),
      ],
      [], settings, TODAY,
    )
    const porConcepto = Object.fromEntries(r.detalle_proximo_mes.map((d) => [d.concepto_id, d]))
    expect(porConcepto[1]).toMatchObject({ criterio: 'cuota_vigente', estimado: 300, historico: [] })
    expect(porConcepto[2]).toMatchObject({ criterio: 'ultima_cuota', estimado: 0, monto_actual: 400 })
  })

  it('los grupos de sub-items llevan su concepto y el del gasto contenedor', () => {
    const r = computeResumen(
      [makeGasto({
        id: 3,
        conceptoId: 1,
        concepto: { nombre: 'Visa' },
        items: [{ conceptoId: 5, concepto: { nombre: 'Super' }, monto: 100, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: null }],
      })],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.detalle_proximo_mes[0]).toMatchObject({
      gasto_ids: [3], cantidad: 1, concepto_id: 5, descripcion: 'Super', gasto_padre: 'Visa', es_subitem: true, estimado: 100,
    })
  })

  it('la suma del detalle es el total y viene ordenado de mayor a menor', () => {
    const r = computeResumen(
      [
        makeGasto({ conceptoId: 1, totalMoneda: 100 }),
        makeGasto({ conceptoId: 2, totalMoneda: 300 }),
        makeGasto({ conceptoId: 3, totalMoneda: 200 }),
      ],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.detalle_proximo_mes.map((d) => d.estimado)).toEqual([300, 200, 100])
    expect(r.detalle_proximo_mes.reduce((s, d) => s + d.estimado, 0)).toBe(r.total_proximo_mes)
  })

  it('un consumo con crédito entra sólo a través del resumen de tarjeta, no como gasto propio', () => {
    const item = { conceptoId: 5, concepto: { nombre: 'Limpieza' }, monto: 100, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: null }
    const r = computeResumen(
      [
        // El consumo cargado con crédito...
        makeGasto({ id: 1, conceptoId: 5, concepto: { nombre: 'Limpieza' }, tipoPago: 'C', totalMoneda: 100 }),
        // ...y su sub-item propagado al resumen de la tarjeta.
        makeGasto({ id: 2, conceptoId: 9, concepto: { nombre: 'Visa' }, tipoPago: 'D', esTarjeta: true, totalMoneda: 100, items: [item] }),
      ],
      // En el mes previo, el consumo con crédito tampoco cuenta para el match.
      [[makeGasto({ conceptoId: 5, tipoPago: 'C', totalMoneda: 999 })]],
      { ...SETTINGS_DEFAULT, estimMesesAtras: 1, estimMissingBehavior: 'average_found' }, TODAY, [], [{ mes: 5, anio: 2026 }],
    )
    expect(r.detalle_proximo_mes).toHaveLength(1)
    expect(r.detalle_proximo_mes[0]).toMatchObject({ gasto_ids: [2], descripcion: 'Limpieza', gasto_padre: 'Visa', estimado: 100 })
    expect(r.total_proximo_mes).toBe(100)
  })

  it('suma los gastos del mismo concepto del mes antes de comparar con los meses previos', () => {
    const settings = { ...SETTINGS_DEFAULT, estimMesesAtras: 1 }
    const r = computeResumen(
      [
        makeGasto({ id: 1, conceptoId: 100, concepto: { nombre: 'Luz' }, totalMoneda: 300 }),
        makeGasto({ id: 2, conceptoId: 100, concepto: { nombre: 'Luz' }, totalMoneda: 500 }),
      ],
      // El mes previo también tenía dos: se comparan las sumas (800 vs 1000), no cada uno contra el primero.
      [[makeGasto({ conceptoId: 100, totalMoneda: 400 }), makeGasto({ conceptoId: 100, totalMoneda: 600 })]],
      settings, TODAY, [], [{ mes: 5, anio: 2026 }],
    )
    expect(r.detalle_proximo_mes).toHaveLength(1)
    expect(r.detalle_proximo_mes[0]).toMatchObject({
      gasto_ids: [1, 2], cantidad: 2, monto_actual: 800,
      historico: [{ mes: 5, anio: 2026, monto: 1000, en_promedio: true }],
      estimado: 900,
    })
    expect(r.total_proximo_mes).toBe(900)
  })

  it('agrupa los sub-items del mismo concepto aunque vengan de resúmenes distintos de la misma tarjeta', () => {
    const item = (monto: number) => ({ conceptoId: 5, concepto: { nombre: 'Super' }, monto, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: null })
    const r = computeResumen(
      [
        makeGasto({ id: 1, conceptoId: 9, concepto: { nombre: 'Visa' }, esTarjeta: true, items: [item(100), item(50)] }),
        makeGasto({ id: 2, conceptoId: 9, concepto: { nombre: 'Visa' }, esTarjeta: true, items: [item(25)] }),
      ],
      [], SETTINGS_DEFAULT, TODAY,
    )
    expect(r.detalle_proximo_mes).toEqual([expect.objectContaining({ gasto_ids: [1, 2], cantidad: 3, estimado: 175 })])
  })

  describe('filtro de casa', () => {
    const CASA = 1
    const OTRA = 2
    // Sub-item propagado: la casa de origen es la del gasto con crédito del pago que lo generó.
    const consumo = (casaId: number | null, monto: number, conceptoId = 5) => ({
      conceptoId, concepto: { nombre: 'Limpieza' }, monto, incluyeEnTotal: true, incluyeEnVencimiento: false, fecha: null,
      pago: casaId == null ? null : { gasto: { casaId } },
    })
    const resumen = (casaId: number, items: any[]) =>
      makeGasto({ id: 50, casaId, conceptoId: 9, concepto: { nombre: 'Visa' }, esTarjeta: true, totalMoneda: 999, items })

    it('cada sub-item del resumen cuenta para la casa de su gasto de origen, no la del resumen', () => {
      const actual = [
        // Resumen de la otra casa con un consumo de esta y uno de la otra.
        resumen(OTRA, [consumo(CASA, 100), consumo(OTRA, 700, 6)]),
        makeGasto({ id: 1, casaId: CASA, conceptoId: 100, totalMoneda: 50 }),
      ]
      const r = computeResumen([], [], SETTINGS_DEFAULT, TODAY, [], [], { actual, casaId: CASA })
      const porConcepto = Object.fromEntries(r.detalle_proximo_mes.map((d) => [d.concepto_id, d.estimado]))
      expect(porConcepto).toEqual({ 5: 100, 100: 50 })
      expect(r.total_proximo_mes).toBe(150)
    })

    it('un resumen propio con todos los consumos de otra casa no aporta su total', () => {
      const r = computeResumen([], [], SETTINGS_DEFAULT, TODAY, [], [], {
        actual: [resumen(CASA, [consumo(OTRA, 700)])],
        casaId: CASA,
      })
      expect(r.detalle_proximo_mes).toEqual([])
    })

    it('un sub-item cargado a mano (sin pago) cuenta para la casa del resumen', () => {
      const r = computeResumen([], [], SETTINGS_DEFAULT, TODAY, [], [], {
        actual: [resumen(CASA, [consumo(null, 80)])],
        casaId: CASA,
      })
      expect(r.total_proximo_mes).toBe(80)
    })

    it('el histórico también se atribuye por casa de origen', () => {
      const settings = { ...SETTINGS_DEFAULT, estimMesesAtras: 1 }
      const r = computeResumen(
        [], [[resumen(OTRA, [consumo(CASA, 300), consumo(OTRA, 5000)])]],
        settings, TODAY, [], [{ mes: 5, anio: 2026 }],
        { actual: [resumen(OTRA, [consumo(CASA, 100)])], casaId: CASA },
      )
      expect(r.detalle_proximo_mes[0].historico[0].monto).toBe(300)
      expect(r.total_proximo_mes).toBe(200)
    })

    it('los totales del resumen siguen usando sólo `gastos`', () => {
      const propio = makeGasto({ casaId: CASA, totalMoneda: 50 })
      const r = computeResumen([propio], [], SETTINGS_DEFAULT, TODAY, [], [], {
        actual: [propio, resumen(OTRA, [consumo(CASA, 100)])],
        casaId: CASA,
      })
      expect(r.total_gastos).toBe(50)
      expect(r.total_proximo_mes).toBe(150)
    })
  })

  it('no lista los gastos no confirmados sin sub-items (no entran al estimado)', () => {
    const r = computeResumen([makeGasto({ confirmado: false })], [], SETTINGS_DEFAULT, TODAY)
    expect(r.detalle_proximo_mes).toEqual([])
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
