import { describe, it, expect } from 'vitest'
import {
  parsePresupuestoBody,
  toPresupuestoResponse,
  computeEjecucion,
  totalesPresupuesto,
  type PresupuestoRow,
  type CategoriaGasto,
} from './presupuestos-compute'

const pres = (categoria_id: number, monto: number, categoria_nombre = 'Cat'): PresupuestoRow =>
  ({ categoria_id, categoria_nombre, monto })
const gasto = (id: number | null, total_ars: number, nombre = 'Cat'): CategoriaGasto =>
  ({ id, nombre, total_ars })

describe('parsePresupuestoBody', () => {
  it('acepta un body válido', () => {
    expect(parsePresupuestoBody({ categoria_id: 1, mes: 6, anio: 2026, monto: 5000 }))
      .toEqual({ categoriaId: 1, mes: 6, anio: 2026, monto: 5000 })
  })

  it('acepta monto 0 ("acá no se gasta nada")', () => {
    expect(parsePresupuestoBody({ categoria_id: 1, mes: 6, anio: 2026, monto: 0 })!.monto).toBe(0)
  })

  it('rechaza monto negativo: un tope negativo no representa nada', () => {
    expect(parsePresupuestoBody({ categoria_id: 1, mes: 6, anio: 2026, monto: -1 })).toBeNull()
  })

  it('rechaza mes fuera de rango y categoría inválida', () => {
    expect(parsePresupuestoBody({ categoria_id: 1, mes: 13, anio: 2026, monto: 1 })).toBeNull()
    expect(parsePresupuestoBody({ categoria_id: 0, mes: 6, anio: 2026, monto: 1 })).toBeNull()
    expect(parsePresupuestoBody({ categoria_id: 1.5, mes: 6, anio: 2026, monto: 1 })).toBeNull()
  })

  it('rechaza bodies incompletos o nulos', () => {
    expect(parsePresupuestoBody({})).toBeNull()
    expect(parsePresupuestoBody(null)).toBeNull()
    expect(parsePresupuestoBody({ categoria_id: 1, mes: 6, anio: 2026 })).toBeNull()
  })
})

describe('toPresupuestoResponse', () => {
  it('mapea a snake_case con el nombre de la categoría', () => {
    expect(toPresupuestoResponse({ id: 3, categoriaId: 1, mes: 6, anio: 2026, monto: 5000, categoria: { nombre: 'Comida' } }))
      .toEqual({ id: 3, categoria_id: 1, categoria_nombre: 'Comida', mes: 6, anio: 2026, monto: 5000, fijado: false })
  })

  it('expone fijado, que es lo que el reparto automático no toca', () => {
    expect(toPresupuestoResponse({ id: 3, categoriaId: 1, mes: 6, anio: 2026, monto: 5000, fijado: true }).fijado).toBe(true)
    // Las filas anteriores a la columna no traen el campo: no puede quedar `undefined`.
    expect(toPresupuestoResponse({ id: 3, categoriaId: 1, mes: 6, anio: 2026, monto: 5000 }).fijado).toBe(false)
  })

  it('sin categoría incluida deja el nombre en null', () => {
    expect(toPresupuestoResponse({ id: 3, categoriaId: 1, mes: 6, anio: 2026, monto: 5000 }).categoria_nombre).toBeNull()
  })
})

describe('computeEjecucion', () => {
  it('cruza presupuesto con gasto', () => {
    const [f] = computeEjecucion([pres(1, 10000, 'Comida')], [gasto(1, 4000, 'Comida')])
    expect(f).toEqual({
      categoria_id: 1, categoria_nombre: 'Comida', monto: 10000, gastado: 4000,
      restante: 6000, consumido_pct: 40, estado: 'ok',
    })
  })

  it('un presupuesto sin gasto queda en 0', () => {
    const [f] = computeEjecucion([pres(1, 10000)], [])
    expect(f.gastado).toBe(0)
    expect(f.restante).toBe(10000)
    expect(f.estado).toBe('ok')
  })

  it('marca "cerca" a partir del 90%', () => {
    expect(computeEjecucion([pres(1, 1000)], [gasto(1, 899)])[0].estado).toBe('ok')
    expect(computeEjecucion([pres(1, 1000)], [gasto(1, 900)])[0].estado).toBe('cerca')
    expect(computeEjecucion([pres(1, 1000)], [gasto(1, 1000)])[0].estado).toBe('cerca')
  })

  it('marca "excedido" recién por encima del 100%', () => {
    const [f] = computeEjecucion([pres(1, 1000)], [gasto(1, 1200)])
    expect(f.estado).toBe('excedido')
    expect(f.restante).toBe(-200)
    expect(f.consumido_pct).toBe(120)
  })

  it('un tope en 0 lo excede cualquier gasto, pero sin gasto sigue ok', () => {
    expect(computeEjecucion([pres(1, 0)], [gasto(1, 1)])[0].estado).toBe('excedido')
    expect(computeEjecucion([pres(1, 0)], [])[0].estado).toBe('ok')
    // Sin dividir por cero.
    expect(computeEjecucion([pres(1, 0)], [gasto(1, 1)])[0].consumido_pct).toBeNull()
  })

  it('las categorías con gasto pero sin presupuesto aparecen igual', () => {
    const filas = computeEjecucion([pres(1, 1000, 'Comida')], [gasto(1, 500, 'Comida'), gasto(2, 800, 'Transporte')])
    const transporte = filas.find(f => f.categoria_id === 2)!
    expect(transporte.monto).toBeNull()
    expect(transporte.gastado).toBe(800)
    expect(transporte.restante).toBeNull()
  })

  it('ignora el bucket "Sin categoría" (id null)', () => {
    const filas = computeEjecucion([], [gasto(null, 5000, 'Sin categoría')])
    expect(filas).toEqual([])
  })

  it('ordena excedidos, luego cerca, luego el resto', () => {
    const filas = computeEjecucion(
      [pres(1, 1000, 'A'), pres(2, 1000, 'B'), pres(3, 1000, 'C')],
      [gasto(1, 100, 'A'), gasto(2, 1500, 'B'), gasto(3, 950, 'C')],
    )
    expect(filas.map(f => f.categoria_nombre)).toEqual(['B', 'C', 'A'])
  })

  it('sin nada devuelve vacío y tolera nulls', () => {
    expect(computeEjecucion([], [])).toEqual([])
    expect(computeEjecucion(null as any, null as any)).toEqual([])
  })
})

describe('totalesPresupuesto', () => {
  it('el gastado cuenta sólo lo presupuestado, y lo demás se informa aparte', () => {
    const filas = computeEjecucion(
      [pres(1, 1000, 'A')],
      [gasto(1, 400, 'A'), gasto(2, 700, 'B')],
    )
    const t = totalesPresupuesto(filas)
    expect(t.presupuestado).toBe(1000)
    expect(t.gastado).toBe(400)
    expect(t.sin_presupuesto).toBe(700)
    expect(t.restante).toBe(600)
    expect(t.consumido_pct).toBe(40)
  })

  it('cuenta cuántas categorías se excedieron', () => {
    const filas = computeEjecucion(
      [pres(1, 100, 'A'), pres(2, 100, 'B'), pres(3, 100, 'C')],
      [gasto(1, 200, 'A'), gasto(2, 300, 'B'), gasto(3, 50, 'C')],
    )
    expect(totalesPresupuesto(filas).excedidas).toBe(2)
  })

  it('sin presupuestos no divide por cero', () => {
    const t = totalesPresupuesto(computeEjecucion([], [gasto(1, 500, 'A')]))
    expect(t.presupuestado).toBe(0)
    expect(t.consumido_pct).toBeNull()
    expect(t.sin_presupuesto).toBe(500)
  })

  it('lista vacía da todo en cero', () => {
    expect(totalesPresupuesto([])).toEqual({
      presupuestado: 0, gastado: 0, sin_presupuesto: 0, restante: 0, consumido_pct: null, excedidas: 0,
    })
  })
})
