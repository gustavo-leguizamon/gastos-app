import { describe, it, expect } from 'vitest'
import { gastosDeBase, gastadoPorCategoria } from './presupuestos-base'

const MESES = [{ mes: 6, anio: 2026 }]

/** Fila cruda de gasto con lo mínimo que necesita la agregación. */
function gasto(over: Record<string, any> = {}) {
  return {
    conceptoId: 1,
    concepto: { id: 1, nombre: 'Algo' },
    totalMoneda: 1000,
    tipoCambio: 1,
    confirmado: true,
    esTarjeta: false,
    tipoPago: 'D',
    categoriaId: null,
    categoria: null,
    etiquetas: [],
    items: [],
    mes: 6,
    anio: 2026,
    ...over,
  }
}

function item(over: Record<string, any> = {}) {
  return {
    conceptoId: 1,
    concepto: { id: 1, nombre: 'Consumo' },
    monto: 100,
    incluyeEnTotal: true,
    categoriaId: null,
    categoria: null,
    etiquetas: [],
    ...over,
  }
}

const cat = (id: number, nombre: string) => ({ categoriaId: id, categoria: { id, nombre } })

/** Monto atribuido a una categoría, o 0 si no aparece. */
const deCat = (r: { por_categoria: { id: number | null; total_ars: number }[] }, id: number | null) =>
  r.por_categoria.find(c => c.id === id)?.total_ars ?? 0

describe('gastosDeBase', () => {
  const debito = gasto({ tipoPago: 'D' })
  const credito = gasto({ tipoPago: 'C' })
  const resumen = gasto({ esTarjeta: true, tipoPago: 'D' })
  const todos = [debito, credito, resumen]

  it('devengado excluye los resúmenes de tarjeta y conserva el crédito individual', () => {
    expect(gastosDeBase(todos, 'devengado')).toEqual([debito, credito])
  })

  it('caja toma el débito e incluye el resumen de tarjeta (que se crea con tipoPago D)', () => {
    expect(gastosDeBase(todos, 'caja')).toEqual([debito, resumen])
  })

  it('no rompe sin gastos', () => {
    expect(gastosDeBase([], 'caja')).toEqual([])
    expect(gastosDeBase(null as any, 'devengado')).toEqual([])
  })
})

describe('gastadoPorCategoria — devengado', () => {
  it('cuenta débito y crédito individual, cada gasto en su categoría', () => {
    const r = gastadoPorCategoria([
      gasto({ ...cat(7, 'Mercados'), tipoPago: 'D', totalMoneda: 1000 }),
      gasto({ ...cat(7, 'Mercados'), tipoPago: 'C', totalMoneda: 500 }),
      gasto({ ...cat(9, 'Servicios'), tipoPago: 'D', totalMoneda: 300 }),
    ], 'devengado', MESES)

    expect(deCat(r, 7)).toBe(1500)
    expect(deCat(r, 9)).toBe(300)
    expect(r.total).toBe(1800)
  })

  it('ignora el resumen de tarjeta: sus consumos ya cuentan uno por uno', () => {
    const r = gastadoPorCategoria([
      gasto({ ...cat(7, 'Mercados'), tipoPago: 'C', totalMoneda: 1000 }),
      gasto({ esTarjeta: true, tipoPago: 'D', totalMoneda: 1000, items: [item({ monto: 1000, ...cat(7, 'Mercados') })] }),
    ], 'devengado', MESES)

    expect(r.total).toBe(1000)
    expect(deCat(r, 7)).toBe(1000)
  })

  it('no_atribuido es 0 aunque los sub-ítems no cierren: el gasto aporta su total entero', () => {
    const r = gastadoPorCategoria([
      gasto({ ...cat(7, 'Mercados'), totalMoneda: 1000, items: [item({ monto: 400 })] }),
    ], 'devengado', MESES)

    expect(r.total).toBe(1000)
    expect(r.no_atribuido).toBe(0)
  })
})

describe('gastadoPorCategoria — caja', () => {
  it('deja fuera el consumo de crédito hasta que se paga el resumen', () => {
    const r = gastadoPorCategoria([
      gasto({ ...cat(7, 'Mercados'), tipoPago: 'C', totalMoneda: 1000 }),
    ], 'caja', MESES)

    expect(r.total).toBe(0)
  })

  it('desglosa el pago del resumen en las categorías de sus consumos', () => {
    const r = gastadoPorCategoria([
      gasto({
        esTarjeta: true,
        tipoPago: 'D',
        ...cat(99, 'Tarjeta crédito'),
        totalMoneda: 1000,
        items: [
          item({ monto: 700, ...cat(7, 'Mercados') }),
          item({ monto: 300, ...cat(9, 'Servicios') }),
        ],
      }),
    ], 'caja', MESES)

    expect(deCat(r, 7)).toBe(700)
    expect(deCat(r, 9)).toBe(300)
    // La categoría del contenedor no participa: lo que importa es en qué se gastó.
    expect(deCat(r, 99)).toBe(0)
    expect(r.total).toBe(1000)
    expect(r.no_atribuido).toBe(0)
  })

  it('el gasto de débito sin sub-ítems cae a su propia categoría', () => {
    const r = gastadoPorCategoria([
      gasto({ ...cat(9, 'Servicios'), tipoPago: 'D', totalMoneda: 300, items: [] }),
    ], 'caja', MESES)

    expect(deCat(r, 9)).toBe(300)
  })

  it('los sub-ítems que no participan del total no se atribuyen', () => {
    const r = gastadoPorCategoria([
      gasto({
        esTarjeta: true,
        totalMoneda: 700,
        items: [
          item({ monto: 700, ...cat(7, 'Mercados') }),
          item({ monto: 250, ...cat(9, 'Servicios'), incluyeEnTotal: false }),
        ],
      }),
    ], 'caja', MESES)

    expect(deCat(r, 7)).toBe(700)
    expect(deCat(r, 9)).toBe(0)
    expect(r.no_atribuido).toBe(0)
  })

  it('expone lo que quedó sin atribuir cuando los sub-ítems no cubren el resumen', () => {
    const r = gastadoPorCategoria([
      gasto({ esTarjeta: true, totalMoneda: 1000, items: [item({ monto: 600, ...cat(7, 'Mercados') })] }),
    ], 'caja', MESES)

    expect(r.total).toBe(600)
    // El resumen salió de la cuenta por 1000, pero sólo 600 tienen categoría.
    expect(r.no_atribuido).toBe(400)
  })

  it('los centavos de redondeo no se reportan como diferencia', () => {
    // Caso real: 65 sub-ítems cargados ya redondeados suman 10 centavos más que el resumen.
    const r = gastadoPorCategoria([
      gasto({
        esTarjeta: true,
        totalMoneda: 1043637.75,
        items: [item({ monto: 1043637.85, ...cat(7, 'Mercados') })],
      }),
    ], 'caja', MESES)

    expect(r.no_atribuido).toBe(0)
  })

  it('una diferencia real sí se reporta', () => {
    const r = gastadoPorCategoria([
      gasto({ esTarjeta: true, totalMoneda: 1000, items: [item({ monto: 998.5, ...cat(7, 'Mercados') })] }),
    ], 'caja', MESES)

    expect(r.no_atribuido).toBe(1.5)
  })

  it('lo sobreatribuido da negativo, no se recorta a 0', () => {
    const r = gastadoPorCategoria([
      gasto({ esTarjeta: true, totalMoneda: 500, items: [item({ monto: 800, ...cat(7, 'Mercados') })] }),
    ], 'caja', MESES)

    expect(r.no_atribuido).toBe(-300)
  })

  it('un resumen sin sub-ítems no se pierde: cae en la categoría del contenedor', () => {
    const r = gastadoPorCategoria([
      gasto({ esTarjeta: true, ...cat(99, 'Tarjeta crédito'), totalMoneda: 1000, items: [] }),
    ], 'caja', MESES)

    expect(deCat(r, 99)).toBe(1000)
    expect(r.no_atribuido).toBe(0)
  })

  it('total + no_atribuido reconstruye el débito del mes (el mismo que mide el ahorro)', () => {
    const gastos = [
      gasto({ ...cat(7, 'Mercados'), tipoPago: 'D', totalMoneda: 1200 }),
      gasto({ ...cat(7, 'Mercados'), tipoPago: 'C', totalMoneda: 999 }),
      gasto({ esTarjeta: true, tipoPago: 'D', totalMoneda: 3000, items: [item({ monto: 2500, ...cat(9, 'Servicios') })] }),
    ]
    const totalDebito = gastos
      .filter(g => g.tipoPago === 'D')
      .reduce((s, g) => s + g.totalMoneda * g.tipoCambio, 0)

    const r = gastadoPorCategoria(gastos, 'caja', MESES)
    expect(r.total + r.no_atribuido).toBe(totalDebito)
  })
})

describe('gastadoPorCategoria — común a las dos bases', () => {
  it('el gasto sin categoría se atribuye a la fila "Sin categoría", no se descarta', () => {
    for (const base of ['devengado', 'caja'] as const) {
      const r = gastadoPorCategoria([gasto({ totalMoneda: 250 })], base, MESES)
      expect(r.por_categoria.find(c => c.id === null)).toMatchObject({ nombre: 'Sin categoría', total_ars: 250 })
      expect(r.total).toBe(250)
    }
  })

  it('el gasto no confirmado con sub-ítems vale por su subtotal en las dos bases', () => {
    const g = gasto({ ...cat(7, 'Mercados'), confirmado: false, totalMoneda: 9999, items: [item({ monto: 400, ...cat(7, 'Mercados') })] })
    expect(gastadoPorCategoria([g], 'devengado', MESES).total).toBe(400)
    expect(gastadoPorCategoria([g], 'caja', MESES).total).toBe(400)
  })

  it('sin gastos devuelve totales en 0', () => {
    for (const base of ['devengado', 'caja'] as const) {
      const r = gastadoPorCategoria([], base, MESES)
      expect(r).toMatchObject({ base, total: 0, no_atribuido: 0 })
      expect(r.por_categoria).toEqual([])
    }
  })
})
