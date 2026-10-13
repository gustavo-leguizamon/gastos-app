import { describe, it, expect } from 'vitest'
import { buscarDuplicados } from './gastos-duplicado'

const base = { descripcion: 'Netflix', mes: 3, anio: 2026, moneda_id: 1, total_moneda: 5000, es_tarjeta: false }
const ex = (o: Partial<typeof base> & { id?: number } = {}) => ({ id: 1, ...base, ...o })

describe('buscarDuplicados', () => {
  it('encuentra el gasto equivalente', () => {
    expect(buscarDuplicados(base, [ex()])).toHaveLength(1)
  })
  it('ignora mayúsculas y espacios del concepto', () => {
    expect(buscarDuplicados({ ...base, descripcion: '  netflix ' }, [ex({ descripcion: 'NETFLIX' })])).toHaveLength(1)
  })
  it('no matchea si cambia monto, moneda, mes, año o concepto', () => {
    for (const o of [{ total_moneda: 1 }, { moneda_id: 2 }, { mes: 4 }, { anio: 2025 }, { descripcion: 'Spotify' }]) {
      expect(buscarDuplicados(base, [ex(o)])).toEqual([])
    }
  })
  it('devuelve todos los repetidos', () => {
    expect(buscarDuplicados(base, [ex({ id: 1 }), ex({ id: 2 })])).toHaveLength(2)
  })
  it('ignora resúmenes de tarjeta de ambos lados', () => {
    expect(buscarDuplicados(base, [ex({ es_tarjeta: true })])).toEqual([])
    expect(buscarDuplicados({ ...base, es_tarjeta: true }, [ex()])).toEqual([])
  })
  it('sin descripción no avisa', () => {
    expect(buscarDuplicados({ ...base, descripcion: '  ' }, [ex({ descripcion: '' })])).toEqual([])
  })
})
