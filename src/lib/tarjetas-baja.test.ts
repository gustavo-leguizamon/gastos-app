import { describe, it, expect } from 'vitest'
import { parseBaja, tarjetaActivaEn, tarjetasActivasEn, tarjetasVisiblesEn } from './tarjetas-baja'

const baja = (bajaMes: number | null, bajaAnio: number | null) => ({ bajaMes, bajaAnio })

describe('tarjetaActivaEn', () => {
  it('sin período de baja la tarjeta está siempre activa', () => {
    expect(tarjetaActivaEn(baja(null, null), 1, 2020)).toBe(true)
    expect(tarjetaActivaEn(baja(null, null), 12, 2099)).toBe(true)
  })

  it('el mes de la baja ya no la muestra', () => {
    expect(tarjetaActivaEn(baja(8, 2026), 8, 2026)).toBe(false)
  })

  it('los meses anteriores a la baja la siguen mostrando (el histórico no se pierde)', () => {
    expect(tarjetaActivaEn(baja(8, 2026), 7, 2026)).toBe(true)
    expect(tarjetaActivaEn(baja(8, 2026), 12, 2025)).toBe(true)
  })

  it('los meses posteriores no la muestran', () => {
    expect(tarjetaActivaEn(baja(8, 2026), 9, 2026)).toBe(false)
    expect(tarjetaActivaEn(baja(8, 2026), 1, 2027)).toBe(false)
  })

  it('compara el período completo, no el mes suelto', () => {
    // Enero 2027 es posterior a diciembre 2026 aunque 1 < 12.
    expect(tarjetaActivaEn(baja(12, 2026), 1, 2027)).toBe(false)
    expect(tarjetaActivaEn(baja(1, 2027), 12, 2026)).toBe(true)
  })

  it('un período de baja a medio cargar no esconde la tarjeta', () => {
    expect(tarjetaActivaEn(baja(8, null), 9, 2026)).toBe(true)
    expect(tarjetaActivaEn(baja(null, 2026), 9, 2026)).toBe(true)
  })

  it('lee el período en las dos convenciones (Prisma camelCase y API snake_case)', () => {
    expect(tarjetaActivaEn({ baja_mes: 8, baja_anio: 2026 }, 9, 2026)).toBe(false)
    expect(tarjetaActivaEn({ baja_mes: 8, baja_anio: 2026 }, 7, 2026)).toBe(true)
    expect(tarjetaActivaEn({ baja_mes: 8, baja_anio: null }, 9, 2026)).toBe(true)
    expect(tarjetaActivaEn({}, 9, 2026)).toBe(true)
  })
})

describe('tarjetasVisiblesEn', () => {
  const tarjetas = [
    { id: 1, ...baja(null, null) },
    { id: 2, ...baja(8, 2026) },
    { id: 3, ...baja(1, 2026) },
  ]

  it('sin ids a conservar es lo mismo que filtrar las activas', () => {
    expect(tarjetasVisiblesEn(tarjetas, 9, 2026).map(t => t.id)).toEqual([1])
  })

  it('conserva las ya elegidas aunque estén de baja, en el orden original', () => {
    expect(tarjetasVisiblesEn(tarjetas, 9, 2026, [3]).map(t => t.id)).toEqual([1, 3])
    expect(tarjetasVisiblesEn(tarjetas, 9, 2026, [2, 3]).map(t => t.id)).toEqual([1, 2, 3])
  })

  it('no duplica una tarjeta que ya estaba activa', () => {
    expect(tarjetasVisiblesEn(tarjetas, 9, 2026, [1]).map(t => t.id)).toEqual([1])
  })

  it('un id a conservar que no existe se ignora', () => {
    expect(tarjetasVisiblesEn(tarjetas, 9, 2026, [99]).map(t => t.id)).toEqual([1])
  })
})

describe('tarjetasActivasEn', () => {
  it('filtra conservando el orden de entrada', () => {
    const tarjetas = [
      { id: 1, ...baja(null, null) },
      { id: 2, ...baja(8, 2026) },
      { id: 3, ...baja(1, 2027) },
    ]
    expect(tarjetasActivasEn(tarjetas, 9, 2026).map(t => t.id)).toEqual([1, 3])
    expect(tarjetasActivasEn(tarjetas, 7, 2026).map(t => t.id)).toEqual([1, 2, 3])
  })

  it('tolera una lista vacía o ausente', () => {
    expect(tarjetasActivasEn([], 9, 2026)).toEqual([])
    expect(tarjetasActivasEn(undefined as any, 9, 2026)).toEqual([])
  })
})

describe('parseBaja', () => {
  it('acepta un período completo', () => {
    expect(parseBaja(8, 2026)).toEqual({ bajaMes: 8, bajaAnio: 2026 })
    expect(parseBaja('8', '2026')).toEqual({ bajaMes: 8, bajaAnio: 2026 })
  })

  it('es todo o nada: un mes sin año (o al revés) no define un corte', () => {
    expect(parseBaja(8, null)).toEqual({ bajaMes: null, bajaAnio: null })
    expect(parseBaja(null, 2026)).toEqual({ bajaMes: null, bajaAnio: null })
    expect(parseBaja(undefined, undefined)).toEqual({ bajaMes: null, bajaAnio: null })
  })

  it('descarta meses fuera de rango y valores no enteros', () => {
    expect(parseBaja(0, 2026)).toEqual({ bajaMes: null, bajaAnio: null })
    expect(parseBaja(13, 2026)).toEqual({ bajaMes: null, bajaAnio: null })
    expect(parseBaja(8.5, 2026)).toEqual({ bajaMes: null, bajaAnio: null })
    expect(parseBaja(8, 2026.5)).toEqual({ bajaMes: null, bajaAnio: null })
    expect(parseBaja('agosto', 2026)).toEqual({ bajaMes: null, bajaAnio: null })
    expect(parseBaja(8, 26)).toEqual({ bajaMes: null, bajaAnio: null })
  })
})
