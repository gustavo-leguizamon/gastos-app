import { describe, it, expect, afterEach } from 'vitest'
import { sueldosEmails, emailPuedeVerSueldos, periodoDe } from './sueldos-auth'

const ORIGINAL = process.env.NEXT_PUBLIC_SUELDOS_EMAILS
afterEach(() => { process.env.NEXT_PUBLIC_SUELDOS_EMAILS = ORIGINAL })

describe('sueldosEmails', () => {
  it('parsea la lista separada por comas, normalizando', () => {
    process.env.NEXT_PUBLIC_SUELDOS_EMAILS = ' Uno@Mail.com , dos@mail.com '
    expect(sueldosEmails()).toEqual(['uno@mail.com', 'dos@mail.com'])
  })

  it('descarta entradas vacías', () => {
    process.env.NEXT_PUBLIC_SUELDOS_EMAILS = 'uno@mail.com,,  ,dos@mail.com'
    expect(sueldosEmails()).toEqual(['uno@mail.com', 'dos@mail.com'])
  })

  it('sin la env var la lista queda vacía', () => {
    delete process.env.NEXT_PUBLIC_SUELDOS_EMAILS
    expect(sueldosEmails()).toEqual([])
  })
})

describe('emailPuedeVerSueldos', () => {
  it('acepta al que está en la lista, sin importar el casing', () => {
    process.env.NEXT_PUBLIC_SUELDOS_EMAILS = 'uno@mail.com'
    expect(emailPuedeVerSueldos('uno@mail.com')).toBe(true)
    expect(emailPuedeVerSueldos('UNO@Mail.com')).toBe(true)
    expect(emailPuedeVerSueldos('  uno@mail.com  ')).toBe(true)
  })

  it('rechaza a cualquier otro', () => {
    process.env.NEXT_PUBLIC_SUELDOS_EMAILS = 'uno@mail.com'
    expect(emailPuedeVerSueldos('otro@mail.com')).toBe(false)
  })

  it('sin email o sin config no entra nadie', () => {
    process.env.NEXT_PUBLIC_SUELDOS_EMAILS = 'uno@mail.com'
    expect(emailPuedeVerSueldos(null)).toBe(false)
    expect(emailPuedeVerSueldos(undefined)).toBe(false)
    expect(emailPuedeVerSueldos('')).toBe(false)

    delete process.env.NEXT_PUBLIC_SUELDOS_EMAILS
    expect(emailPuedeVerSueldos('uno@mail.com')).toBe(false)
  })
})

describe('periodoDe', () => {
  it('usa el período explícito del body cuando es válido', () => {
    expect(periodoDe({ fecha: '2026-07-31', mes: 8, anio: 2026 })).toEqual({ mes: 8, anio: 2026 })
  })

  it('lo deriva de la fecha cuando no viene', () => {
    expect(periodoDe({ fecha: '2026-07-31' })).toEqual({ mes: 7, anio: 2026 })
  })

  it('ignora un período inválido y cae a la fecha', () => {
    expect(periodoDe({ fecha: '2026-07-31', mes: 13, anio: 2026 })).toEqual({ mes: 7, anio: 2026 })
    expect(periodoDe({ fecha: '2026-07-31', mes: 0, anio: 2026 })).toEqual({ mes: 7, anio: 2026 })
  })

  it('sin período ni fecha válida marca 1/2000, que salta a la vista', () => {
    expect(periodoDe({})).toEqual({ mes: 1, anio: 2000 })
    expect(periodoDe({ fecha: '31/07/2026' })).toEqual({ mes: 1, anio: 2000 })
    expect(periodoDe(null)).toEqual({ mes: 1, anio: 2000 })
  })
})
