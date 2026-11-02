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
  it('sin comisión: monto / cotización, y se paga el monto', () => {
    expect(entregaPlataforma(plat(), 100000)).toEqual({ divisa: 100, comision_ars: 0, total_ars: 100000 })
  })

  it('comisión % en pesos: se suma encima del monto de la compra (3% sobre 10.000 → salen 10.300)', () => {
    expect(entregaPlataforma(plat({ comision: 3 }), 10000)).toEqual({ divisa: 10, comision_ars: 300, total_ars: 10300 })
  })

  it('comisión fija en pesos: se suma encima', () => {
    expect(entregaPlataforma(plat({ comision_tipo: 'FIJA', comision: 1000 }), 100000)).toEqual({
      divisa: 100,
      comision_ars: 1000,
      total_ars: 101000,
    })
  })

  it('comisión % en divisa: se resta de lo comprado y el total es el monto', () => {
    expect(entregaPlataforma(plat({ comision: 1, comision_moneda: 'DIVISA' }), 100000)).toEqual({
      divisa: 99,
      comision_ars: 1000,
      total_ars: 100000,
    })
  })

  it('comisión fija en divisa', () => {
    expect(
      entregaPlataforma(plat({ comision_tipo: 'FIJA', comision: 2, comision_moneda: 'DIVISA' }), 100000),
    ).toEqual({ divisa: 98, comision_ars: 2000, total_ars: 100000 })
  })

  it('null si la comisión en divisa se come la compra o los datos no sirven', () => {
    expect(entregaPlataforma(plat({ comision_tipo: 'FIJA', comision: 100, comision_moneda: 'DIVISA' }), 100000)).toBeNull()
    expect(entregaPlataforma(plat(), 0)).toBeNull()
    expect(entregaPlataforma(plat({ cotizacion: 0 }), 1000)).toBeNull()
  })
})

describe('compararPlataformas', () => {
  const barata = plat({ id: 1, nombre: 'Barata', cotizacion: 1000, comision: 2 })
  const cara = plat({ id: 2, nombre: 'Cara', cotizacion: 1010, comision: 0 })

  it('ordena por cotización efectiva y marca sólo la primera', () => {
    // barata: 1000·1,02 = 1020 efectiva; cara: 1010 → gana la "cara" sin comisión
    const r = compararPlataformas([barata, cara], 1010000)
    expect(r.map((x) => x.plataforma.nombre)).toEqual(['Cara', 'Barata'])
    expect(r.map((x) => x.es_mejor)).toEqual([true, false])
    expect(r[0].cotizacion_efectiva).toBe(1010)
    expect(r[1].cotizacion_efectiva).toBe(1020)
    expect(r[0].sobrecosto_pct).toBe(0)
    expect(r[1].sobrecosto_pct).toBeCloseTo(0.99, 2)
    expect(r[1].sobrecosto_ars).toBeGreaterThan(0)
  })

  it('compara una comisión en pesos contra una en divisa por la efectiva', () => {
    const enPesos = plat({ id: 1, nombre: 'Pesos', cotizacion: 1000, comision: 3 })
    const enDivisa = plat({ id: 2, nombre: 'Divisa', cotizacion: 1000, comision: 2, comision_moneda: 'DIVISA' })
    const r = compararPlataformas([enPesos, enDivisa], 100000)
    expect(r[0].plataforma.nombre).toBe('Divisa')
    expect(r[0].total_ars).toBe(100000)
    expect(r[1].total_ars).toBe(103000)
  })

  it('una comisión fija pesa distinto según el monto', () => {
    const fija = plat({ id: 3, nombre: 'Fija', cotizacion: 1000, comision_tipo: 'FIJA', comision: 10000 })
    const pct = plat({ id: 4, nombre: 'Pct', cotizacion: 1000, comision: 1 })
    expect(compararPlataformas([fija, pct], 200000)[0].plataforma.nombre).toBe('Pct')
    expect(compararPlataformas([fija, pct], 5000000)[0].plataforma.nombre).toBe('Fija')
  })

  it('las que no sirven quedan al final y sin mejor', () => {
    const come = plat({ id: 3, nombre: 'Come', comision_tipo: 'FIJA', comision: 100, comision_moneda: 'DIVISA' })
    const r = compararPlataformas([come, barata], 10000)
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
