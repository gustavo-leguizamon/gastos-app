import { describe, it, expect } from 'vitest'
import {
  compararPlataformas,
  entregaPlataforma,
  parsePlataformaBody,
  toPlataformaResponse,
} from './divisas-plataformas'
import type { PlataformaDivisa } from './types'

const plat = (over: Partial<PlataformaDivisa> = {}): PlataformaDivisa => ({
  id: 1,
  nombre: 'A',
  moneda_id: 2,
  cotizacion: 1000,
  comision_tipo: 'PORCENTAJE',
  comision: 0,
  comision_moneda: 'ARS',
  nota: null,
  activa: true,
  updated_at: '',
  ...over,
})

describe('entregaPlataforma', () => {
  it('sin comisión: monto / cotización', () => {
    expect(entregaPlataforma(plat(), 100000)).toEqual({ divisa: 100, comision_ars: 0 })
  })

  it('comisión % en pesos: se suma encima, el monto es lo que sale de la cuenta', () => {
    // 101000 = Q·1000·1.01 → Q = 100
    expect(entregaPlataforma(plat({ comision: 1 }), 101000)).toEqual({ divisa: 100, comision_ars: 1000 })
  })

  it('comisión fija en pesos: se descuenta del monto antes de comprar', () => {
    expect(entregaPlataforma(plat({ comision_tipo: 'FIJA', comision: 1000 }), 101000)).toEqual({
      divisa: 100,
      comision_ars: 1000,
    })
  })

  it('comisión % en divisa: se resta de lo comprado', () => {
    // 100 brutos − 1% = 99; comisión = 1 × 1000
    expect(entregaPlataforma(plat({ comision: 1, comision_moneda: 'DIVISA' }), 100000)).toEqual({
      divisa: 99,
      comision_ars: 1000,
    })
  })

  it('comisión fija en divisa', () => {
    expect(
      entregaPlataforma(plat({ comision_tipo: 'FIJA', comision: 2, comision_moneda: 'DIVISA' }), 100000),
    ).toEqual({ divisa: 98, comision_ars: 2000 })
  })

  it('null si el monto no cubre la comisión o los datos no sirven', () => {
    expect(entregaPlataforma(plat({ comision_tipo: 'FIJA', comision: 5000 }), 5000)).toBeNull()
    expect(entregaPlataforma(plat(), 0)).toBeNull()
    expect(entregaPlataforma(plat({ cotizacion: 0 }), 1000)).toBeNull()
  })
})

describe('compararPlataformas', () => {
  const barata = plat({ id: 1, nombre: 'Barata', cotizacion: 1000, comision: 2 })
  const cara = plat({ id: 2, nombre: 'Cara', cotizacion: 1010, comision: 0 })

  it('ordena de mejor a peor y marca sólo la primera', () => {
    // barata: 1000·1.02 = 1020 efectiva; cara: 1010 efectiva → gana la "cara" sin comisión
    const r = compararPlataformas([barata, cara], 1010000)
    expect(r.map((x) => x.plataforma.nombre)).toEqual(['Cara', 'Barata'])
    expect(r.map((x) => x.es_mejor)).toEqual([true, false])
    expect(r[0].sobrecosto_pct).toBe(0)
    expect(r[1].sobrecosto_pct).toBeCloseTo(0.99, 2)
    expect(r[1].divisa_menos).toBeGreaterThan(0)
  })

  it('una comisión fija pesa distinto según el monto', () => {
    const fija = plat({ id: 3, nombre: 'Fija', cotizacion: 1000, comision_tipo: 'FIJA', comision: 10000 })
    const pct = plat({ id: 4, nombre: 'Pct', cotizacion: 1000, comision: 1 })
    expect(compararPlataformas([fija, pct], 200000)[0].plataforma.nombre).toBe('Pct')
    expect(compararPlataformas([fija, pct], 5000000)[0].plataforma.nombre).toBe('Fija')
  })

  it('las que no alcanzan quedan al final y sin mejor', () => {
    const fija = plat({ id: 3, nombre: 'Fija', comision_tipo: 'FIJA', comision: 50000 })
    const r = compararPlataformas([fija, barata], 10000)
    expect(r[0].plataforma.nombre).toBe('Barata')
    expect(r[1].divisa_obtenida).toBeNull()
    expect(r[1].es_mejor).toBe(false)
  })

  it('lista vacía o monto inválido no rompe', () => {
    expect(compararPlataformas([], 1000)).toEqual([])
    expect(compararPlataformas([barata], 0)[0].divisa_obtenida).toBeNull()
  })
})

describe('parsePlataformaBody', () => {
  const ok = { nombre: ' Brubank ', moneda_id: 2, cotizacion: 1450 }

  it('normaliza y aplica defaults', () => {
    expect(parsePlataformaBody(ok)).toEqual({
      nombre: 'Brubank',
      monedaId: 2,
      cotizacion: 1450,
      comisionTipo: 'PORCENTAJE',
      comision: 0,
      comisionMoneda: 'ARS',
      nota: null,
      activa: true,
    })
  })

  it('respeta tipo, moneda de comisión y activa=false', () => {
    expect(
      parsePlataformaBody({ ...ok, comision_tipo: 'FIJA', comision: 500, comision_moneda: 'DIVISA', activa: false }),
    ).toMatchObject({ comisionTipo: 'FIJA', comision: 500, comisionMoneda: 'DIVISA', activa: false })
  })

  it('rechaza lo inválido', () => {
    for (const body of [
      null,
      { ...ok, nombre: '  ' },
      { ...ok, moneda_id: 0 },
      { ...ok, cotizacion: 0 },
      { ...ok, comision: -1 },
      { ...ok, comision: 100 },
    ]) {
      expect(parsePlataformaBody(body)).toBeNull()
    }
  })

  it('una comisión fija puede superar 100', () => {
    expect(parsePlataformaBody({ ...ok, comision_tipo: 'FIJA', comision: 500 })).not.toBeNull()
  })
})

describe('toPlataformaResponse', () => {
  it('mapea a snake_case', () => {
    const r = toPlataformaResponse({
      id: 1,
      nombre: 'X',
      monedaId: 2,
      cotizacion: 1,
      comisionTipo: 'FIJA',
      comision: 3,
      comisionMoneda: 'DIVISA',
      nota: null,
      activa: true,
      updatedAt: new Date('2026-11-02T00:00:00Z'),
    })
    expect(r).toMatchObject({ moneda_id: 2, comision_tipo: 'FIJA', comision_moneda: 'DIVISA', updated_at: '2026-11-02T00:00:00.000Z' })
  })
})
