import { describe, it, expect, afterEach } from 'vitest'
import { calcularSueldo, alcanzaTeorico, emailPuedeVerSueldos, periodoDe, FACTOR_NETO_BRUTO } from './sueldos-compute'

describe('calcularSueldo', () => {
  it('el neto suma el tramo en dólares valuado al MEP', () => {
    const { neto } = calcularSueldo({ sueldo_ars: 100000, sueldo_usd: 500, cotizacion_mep: 1200 })
    expect(neto).toBe(700000)
  })

  it('sin dólares el neto es el monto en pesos', () => {
    expect(calcularSueldo({ sueldo_ars: 100000, sueldo_usd: 0, cotizacion_mep: 1200 }).neto).toBe(100000)
  })

  it('sin cotización el tramo en dólares no aporta', () => {
    expect(calcularSueldo({ sueldo_ars: 100000, sueldo_usd: 500, cotizacion_mep: 0 }).neto).toBe(100000)
  })

  it('el bruto es el neto sobre el factor', () => {
    const { neto, bruto } = calcularSueldo({ sueldo_ars: 83000, sueldo_usd: 0, cotizacion_mep: 0 })
    expect(neto).toBe(83000)
    expect(bruto).toBeCloseTo(100000, 5)
    expect(bruto).toBeCloseTo(neto / FACTOR_NETO_BRUTO, 10)
  })

  it('todo en cero da cero', () => {
    expect(calcularSueldo({ sueldo_ars: 0, sueldo_usd: 0, cotizacion_mep: 0 })).toEqual({ neto: 0, bruto: 0 })
  })
})

describe('alcanzaTeorico', () => {
  const base = { sueldo_ars: 83000, sueldo_usd: 0, cotizacion_mep: 0 }

  it('true cuando el bruto llega al teórico', () => {
    expect(alcanzaTeorico({ ...base, sueldo_teorico: 90000 })).toBe(true)
  })

  it('false cuando no llega', () => {
    expect(alcanzaTeorico({ ...base, sueldo_teorico: 120000 })).toBe(false)
  })

  it('el borde exacto cuenta como alcanzado', () => {
    expect(alcanzaTeorico({ ...base, sueldo_teorico: 83000 / FACTOR_NETO_BRUTO })).toBe(true)
  })

  it('sin teórico cargado no hay comparación', () => {
    expect(alcanzaTeorico(base)).toBeNull()
    expect(alcanzaTeorico({ ...base, sueldo_teorico: 0 })).toBeNull()
  })
})

describe('emailPuedeVerSueldos', () => {
  const original = process.env.NEXT_PUBLIC_SUELDOS_EMAILS
  afterEach(() => { process.env.NEXT_PUBLIC_SUELDOS_EMAILS = original })

  it('sin la env var no la ve nadie', () => {
    delete process.env.NEXT_PUBLIC_SUELDOS_EMAILS
    expect(emailPuedeVerSueldos('alguien@mail.com')).toBe(false)
  })

  it('la env var vacía tampoco habilita a nadie', () => {
    process.env.NEXT_PUBLIC_SUELDOS_EMAILS = '   '
    expect(emailPuedeVerSueldos('alguien@mail.com')).toBe(false)
  })

  it('habilita a los de la lista, sin importar mayúsculas ni espacios', () => {
    process.env.NEXT_PUBLIC_SUELDOS_EMAILS = ' Uno@Mail.com , dos@mail.com '
    expect(emailPuedeVerSueldos('uno@mail.com')).toBe(true)
    expect(emailPuedeVerSueldos('  DOS@MAIL.COM ')).toBe(true)
    expect(emailPuedeVerSueldos('tres@mail.com')).toBe(false)
  })

  it('sin email no habilita', () => {
    process.env.NEXT_PUBLIC_SUELDOS_EMAILS = 'uno@mail.com'
    expect(emailPuedeVerSueldos(null)).toBe(false)
    expect(emailPuedeVerSueldos(undefined)).toBe(false)
    expect(emailPuedeVerSueldos('')).toBe(false)
  })
})

describe('periodoDe', () => {
  it('usa mes/anio del body cuando vienen', () => {
    expect(periodoDe({ mes: 8, anio: 2026, fecha: '2026-07-31' })).toEqual({ mes: 8, anio: 2026 })
  })

  it('los deriva de la fecha cuando no vienen', () => {
    expect(periodoDe({ fecha: '2026-07-31' })).toEqual({ mes: 7, anio: 2026 })
  })

  it('el día 1 y el último día no se corren de mes', () => {
    expect(periodoDe({ fecha: '2026-08-01' })).toEqual({ mes: 8, anio: 2026 })
    expect(periodoDe({ fecha: '2026-08-31' })).toEqual({ mes: 8, anio: 2026 })
    expect(periodoDe({ fecha: '2026-12-31' })).toEqual({ mes: 12, anio: 2026 })
  })

  it('ignora un período fuera de rango y cae a la fecha', () => {
    expect(periodoDe({ mes: 13, anio: 2026, fecha: '2026-07-15' })).toEqual({ mes: 7, anio: 2026 })
    expect(periodoDe({ mes: 0, anio: 2026, fecha: '2026-07-15' })).toEqual({ mes: 7, anio: 2026 })
  })

  it('sin período ni fecha válida devuelve un período obviamente incorrecto', () => {
    expect(periodoDe({})).toEqual({ mes: 1, anio: 2000 })
    expect(periodoDe({ fecha: '15/07/2026' })).toEqual({ mes: 1, anio: 2000 })
  })
})
