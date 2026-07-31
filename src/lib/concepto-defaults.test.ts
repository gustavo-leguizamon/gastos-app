import { describe, it, expect } from 'vitest'
import { toConceptoDefaults, ULTIMO_USO_ORDER_BY, type UltimoUsoGasto } from './concepto-defaults'

const base: UltimoUsoGasto = {
  casaId: 2,
  tipoPago: 'C',
  monedaId: 1,
  tipoCambio: 1,
  tarjetaId: 7,
  categoriaId: 5,
  etiquetas: [{ id: 10 }, { id: 11 }],
  totalMoneda: 5900,
  mes: 6,
  anio: 2026,
}

describe('toConceptoDefaults', () => {
  it('devuelve null cuando el concepto no tiene histórico', () => {
    expect(toConceptoDefaults(null)).toBeNull()
    expect(toConceptoDefaults(undefined)).toBeNull()
  })

  it('mapea camelCase → snake_case con el origen del dato', () => {
    expect(toConceptoDefaults(base)).toEqual({
      casa_id: 2,
      tipo_pago: 'C',
      moneda_id: 1,
      tipo_cambio: 1,
      tarjeta_id: 7,
      categoria_id: 5,
      etiqueta_ids: [10, 11],
      total_moneda: 5900,
      origen: { mes: 6, anio: 2026 },
    })
  })

  it('no hereda la tarjeta si el pago no era con crédito', () => {
    const d = toConceptoDefaults({ ...base, tipoPago: 'D' })
    expect(d?.tipo_pago).toBe('D')
    expect(d?.tarjeta_id).toBeNull()
  })

  it('normaliza un tipoPago histórico inesperado a débito', () => {
    expect(toConceptoDefaults({ ...base, tipoPago: 'X' })?.tipo_pago).toBe('D')
  })

  it('tolera gastos sin categoría, sin etiquetas y sin tarjeta', () => {
    const d = toConceptoDefaults({ ...base, categoriaId: null, etiquetas: undefined, tarjetaId: null })
    expect(d?.categoria_id).toBeNull()
    expect(d?.etiqueta_ids).toEqual([])
    expect(d?.tarjeta_id).toBeNull()
  })

  it('preserva montos negativos (devoluciones/reintegros)', () => {
    expect(toConceptoDefaults({ ...base, totalMoneda: -1500 })?.total_moneda).toBe(-1500)
  })

  it('ordena por anio, mes, id descendente', () => {
    expect(ULTIMO_USO_ORDER_BY).toEqual([{ anio: 'desc' }, { mes: 'desc' }, { id: 'desc' }])
  })
})
