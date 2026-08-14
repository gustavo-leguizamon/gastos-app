import { describe, it, expect } from 'vitest'
import { buildVencimientosPush, TAG_VENCIMIENTOS } from './push-payload'
import type { VencimientoHoy } from './vencimientos'

function entrada(descripcion: string, monto: number, over: Partial<VencimientoHoy> = {}): VencimientoHoy {
  return { key: `g-${descripcion}`, tipo: 'gasto', descripcion, monto, ...over }
}

describe('buildVencimientosPush', () => {
  it('sin vencimientos no manda nada', () => {
    expect(buildVencimientosPush([])).toBeNull()
    expect(buildVencimientosPush(null)).toBeNull()
  })

  it('con un solo vencimiento nombra el gasto y su monto', () => {
    const p = buildVencimientosPush([entrada('Luz', 12345.67, { casa_nombre: 'Casa' })])!
    expect(p.title).toBe('Vence hoy: Luz')
    expect(p.body).toContain('12.345,67')
    expect(p.body).toContain('Casa')
    expect(p.url).toBe('/gastos')
    expect(p.tag).toBe(TAG_VENCIMIENTOS)
  })

  it('omite la casa cuando no viene', () => {
    const p = buildVencimientosPush([entrada('Luz', 1000)])!
    expect(p.body).not.toContain('·')
  })

  it('con varios suma el total y lista las descripciones', () => {
    const p = buildVencimientosPush([
      entrada('Luz', 1000),
      entrada('Internet', 2000),
    ])!
    expect(p.title).toBe('2 vencimientos hoy')
    expect(p.body).toContain('3.000')
    expect(p.body).toContain('Luz, Internet')
  })

  it('con más de tres resume el resto', () => {
    const p = buildVencimientosPush([
      entrada('Luz', 100),
      entrada('Internet', 100),
      entrada('Gas', 100),
      entrada('Agua', 100),
      entrada('Cable', 100),
    ])!
    expect(p.title).toBe('5 vencimientos hoy')
    expect(p.body).toContain('Luz, Internet, Gas y 2 más')
  })
})
