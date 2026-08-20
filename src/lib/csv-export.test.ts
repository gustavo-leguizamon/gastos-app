import { describe, it, expect } from 'vitest'
import { gastosACsv, subitemsACsv, aplanarSubitems, reporteACsv } from './csv-export'
import type { Gasto, Reporte } from './types'

function gasto(over: Partial<Gasto> = {}): Gasto {
  return {
    id: 1,
    casa_id: 1,
    casa_nombre: 'Casa',
    concepto_id: 1,
    descripcion: 'Luz',
    fecha_vencimiento: '2026-06-10',
    tipo_pago: 'D',
    moneda_id: 1,
    moneda_codigo: 'ARS',
    tipo_cambio: 1,
    total_moneda: 1000,
    total_ars: 1000,
    total_pagado: 400,
    total_restante: 600,
    pasaje_mes_siguiente: 0,
    prestamo_a_otro: 0,
    tarjeta_id: null,
    tarjeta_nombre: null,
    categoria_id: null,
    categoria: null,
    etiqueta_ids: [],
    etiquetas: [],
    cuota_actual: null,
    cuotas_totales: null,
    mes: 6,
    anio: 2026,
    notas: null,
    confirmado: true,
    es_tarjeta: false,
    created_at: '',
    updated_at: '',
    pagos: [],
    items: [],
    ...over,
  } as Gasto
}

function item(over: Partial<Gasto['items'][number]> = {}): Gasto['items'][number] {
  return {
    id: 10,
    gasto_id: 1,
    concepto_id: 2,
    descripcion: 'Netflix',
    monto: 300,
    fecha: '2026-06-05',
    cuota_actual: null,
    cuotas_totales: null,
    incluye_en_total: true,
    incluye_en_vencimiento: false,
    verificado: false,
    categoria_id: null,
    categoria: null,
    etiqueta_ids: [],
    etiquetas: [],
    created_at: '',
    ...over,
  }
}

describe('gastosACsv', () => {
  it('emite encabezado y una fila por gasto', () => {
    const csv = gastosACsv([gasto(), gasto({ id: 2, descripcion: 'Gas' })])
    const lineas = csv.replace(/^﻿/, '').trim().split('\r\n')
    expect(lineas).toHaveLength(3)
    expect(lineas[0]).toContain('Descripción')
    expect(lineas[1]).toContain('Luz')
    expect(lineas[2]).toContain('Gas')
  })

  it('traduce mes, tipo de pago y booleanos', () => {
    const csv = gastosACsv([gasto({ mes: 6, tipo_pago: 'C', confirmado: false, es_tarjeta: true })])
    expect(csv).toContain('Junio')
    expect(csv).toContain('Crédito')
    expect(csv).toContain('No')
    expect(csv).toContain('Sí')
  })

  it('incluye los computados que no se pueden recalcular desde el CSV', () => {
    const csv = gastosACsv([gasto({ total_ars: 1000, total_pagado: 400, total_restante: 600 })])
    const fila = csv.replace(/^﻿/, '').trim().split('\r\n')[1].split(';')
    expect(fila).toContain('1000')
    expect(fila).toContain('400')
    expect(fila).toContain('600')
  })

  it('junta las etiquetas en una celda', () => {
    const csv = gastosACsv([gasto({ etiquetas: [{ id: 1, nombre: 'Viaje' }, { id: 2, nombre: 'Deducible' }] })])
    expect(csv).toContain('Viaje, Deducible')
  })

  it('formatea la cuota y la deja vacía si no hay', () => {
    expect(gastosACsv([gasto({ cuota_actual: 3, cuotas_totales: 12 })])).toContain('3/12')
    const sinCuota = gastosACsv([gasto()]).replace(/^﻿/, '').trim().split('\r\n')[1]
    expect(sinCuota).not.toContain('/12')
  })

  it('lista vacía deja sólo el encabezado', () => {
    expect(gastosACsv([]).replace(/^﻿/, '').trim().split('\r\n')).toHaveLength(1)
  })
})

describe('aplanarSubitems / subitemsACsv', () => {
  it('una fila por sub-ítem, con el gasto padre de contexto', () => {
    const filas = aplanarSubitems([
      gasto({ descripcion: 'Visa', items: [item(), item({ id: 11, descripcion: 'Spotify' })] }),
    ])
    expect(filas).toHaveLength(2)
    expect(filas[0].gasto.descripcion).toBe('Visa')
    expect(filas[1].item.descripcion).toBe('Spotify')
  })

  it('los gastos sin sub-ítems no aportan filas', () => {
    expect(aplanarSubitems([gasto({ items: [] }), gasto({ id: 2, items: [item()] })])).toHaveLength(1)
  })

  it('el CSV trae el gasto padre y el sub-ítem', () => {
    const csv = subitemsACsv([gasto({ descripcion: 'Visa', items: [item({ descripcion: 'Netflix', monto: 300 })] })])
    const fila = csv.replace(/^﻿/, '').trim().split('\r\n')[1]
    expect(fila).toContain('Visa')
    expect(fila).toContain('Netflix')
    expect(fila).toContain('300')
  })
})

describe('reporteACsv', () => {
  const reporte: Reporte = {
    kpis: { total: 1500, promedio_mensual: 750, cantidad_gastos: 3, meses: 2, total_previo: 1000, variacion_pct: 50 },
    por_categoria: [{ id: 1, nombre: 'Comida', total_ars: 900 }],
    por_etiqueta: [{ id: 2, nombre: 'Viaje', total_ars: 400 }],
    por_mes: [{ mes: 6, anio: 2026, label: 'jun 2026', total_ars: 700 }],
    top_conceptos: [{ concepto_id: 1, nombre: 'Luz', total_ars: 600 }],
    por_tarjeta: [{ id: null, nombre: 'Sin tarjeta', total_ars: 1500 }],
    por_tipo_pago: [{ tipo: 'D', nombre: 'Débito', total_ars: 1500 }],
    por_casa: [{ id: 1, nombre: 'Casa', total_ars: 1500 }],
  }

  it('emite un bloque por dimensión, con título', () => {
    const csv = reporteACsv(reporte)
    for (const titulo of ['KPIs', 'Por categoría', 'Por etiqueta', 'Por casa', 'Por tarjeta', 'Por tipo de pago', 'Por mes', 'Top conceptos']) {
      expect(csv).toContain(titulo)
    }
  })

  it('incluye la comparación con el período anterior en los KPIs', () => {
    const csv = reporteACsv(reporte)
    expect(csv).toContain('Total período anterior')
    expect(csv).toContain('1000')
    expect(csv).toContain('50')
  })

  it('omite los bloques vacíos', () => {
    const csv = reporteACsv({ ...reporte, por_etiqueta: [], por_casa: [] })
    expect(csv).not.toContain('Por etiqueta')
    expect(csv).not.toContain('Por casa')
    expect(csv).toContain('Por categoría')
  })

  it('el BOM aparece una sola vez, al principio', () => {
    const csv = reporteACsv(reporte)
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.split('﻿')).toHaveLength(2)
  })
})
