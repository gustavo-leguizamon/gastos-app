import { describe, it, expect } from 'vitest'
import { buildVencimientosPush, TAG_VENCIMIENTOS } from './push-payload'
import type { VencimientoHoy } from './vencimientos'

function entrada(descripcion: string, monto: number, over: Partial<VencimientoHoy> = {}): VencimientoHoy {
  return {
    key: `g-${descripcion}`,
    tipo: 'gasto',
    descripcion,
    monto,
    estado: 'hoy',
    fecha: '2026-08-14',
    dias_atraso: 0,
    ...over,
  }
}

/** Atajo para una entrada ya vencida: `estado` + `dias_atraso` van siempre juntos. */
function vencida(descripcion: string, monto: number, dias: number, over: Partial<VencimientoHoy> = {}): VencimientoHoy {
  return entrada(descripcion, monto, { estado: 'vencido', dias_atraso: dias, ...over })
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

  describe('vencidos', () => {
    it('un solo vencido dice hace cuánto, no "vence hoy"', () => {
      const p = buildVencimientosPush([vencida('Luz', 12345.67, 3, { casa_nombre: 'Casa' })])!
      expect(p.title).toBe('Vencido hace 3 días: Luz')
      expect(p.body).toContain('12.345,67')
      expect(p.body).toContain('Casa')
    })

    it('un día de atraso va en singular', () => {
      const p = buildVencimientosPush([vencida('Luz', 100, 1)])!
      expect(p.title).toBe('Vencido hace 1 día: Luz')
    })

    it('varios vencidos y ninguno de hoy', () => {
      const p = buildVencimientosPush([
        vencida('Luz', 1000, 5),
        vencida('Gas', 2000, 2),
      ])!
      expect(p.title).toBe('2 vencimientos atrasados')
      expect(p.body).toContain('3.000')
    })

    it('mezcla de vencidos y de hoy los cuenta por separado', () => {
      const p = buildVencimientosPush([
        entrada('Internet', 500),
        vencida('Luz', 1000, 5),
        vencida('Gas', 2000, 2),
      ])!
      expect(p.title).toBe('2 vencidos y 1 vence hoy')
      expect(p.body).toContain('3.500')
    })

    it('un vencido y uno de hoy van ambos en singular', () => {
      const p = buildVencimientosPush([entrada('Internet', 500), vencida('Luz', 1000, 5)])!
      expect(p.title).toBe('1 vencido y 1 vence hoy')
    })

    it('los vencidos se listan antes que los de hoy', () => {
      const p = buildVencimientosPush([
        entrada('Internet', 500),
        entrada('Cable', 500),
        vencida('Luz', 1000, 5),
      ])!
      expect(p.body).toContain('Luz, Internet, Cable')
    })

    it('una entrada sin estado se toma como de hoy (forma vieja)', () => {
      const vieja = { key: 'g-1', tipo: 'gasto', descripcion: 'Luz', monto: 100 } as unknown as VencimientoHoy
      const p = buildVencimientosPush([vieja])!
      expect(p.title).toBe('Vence hoy: Luz')
    })
  })
})
