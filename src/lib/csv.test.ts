import { describe, it, expect } from 'vitest'
import { escapeCsv, toCsv, nombreArchivo, CSV_SEP, BOM, type CsvColumn } from './csv'

describe('escapeCsv', () => {
  it('deja pasar el texto simple', () => {
    expect(escapeCsv('Luz')).toBe('Luz')
  })

  it('null y undefined quedan como celda vacía, no como "null"', () => {
    expect(escapeCsv(null)).toBe('')
    expect(escapeCsv(undefined)).toBe('')
  })

  it('los booleanos se traducen', () => {
    expect(escapeCsv(true)).toBe('Sí')
    expect(escapeCsv(false)).toBe('No')
  })

  it('los números usan coma decimal', () => {
    expect(escapeCsv(1234.5)).toBe('1234,5')
    expect(escapeCsv(-99.99)).toBe('-99,99')
    expect(escapeCsv(1000)).toBe('1000')
  })

  it('NaN e Infinity quedan vacíos', () => {
    expect(escapeCsv(NaN)).toBe('')
    expect(escapeCsv(Infinity)).toBe('')
  })

  it('entrecomilla cuando hay separador', () => {
    expect(escapeCsv('Luz; Gas')).toBe('"Luz; Gas"')
  })

  it('duplica las comillas internas', () => {
    expect(escapeCsv('El "grande"')).toBe('"El ""grande"""')
  })

  it('entrecomilla los saltos de línea', () => {
    expect(escapeCsv('linea1\nlinea2')).toBe('"linea1\nlinea2"')
    expect(escapeCsv('linea1\r\nlinea2')).toBe('"linea1\r\nlinea2"')
  })

  it('una coma sola no fuerza comillas (el separador es ;)', () => {
    expect(escapeCsv('Luz, Gas')).toBe('Luz, Gas')
  })
})

describe('toCsv', () => {
  interface Fila { nombre: string; monto: number; nota: string | null }
  const cols: CsvColumn<Fila>[] = [
    { header: 'Nombre', value: r => r.nombre },
    { header: 'Monto', value: r => r.monto },
    { header: 'Nota', value: r => r.nota },
  ]

  it('arma encabezado y filas con el separador', () => {
    const csv = toCsv([{ nombre: 'Luz', monto: 1000, nota: null }], cols)
    const lineas = csv.replace(BOM, '').trim().split('\r\n')
    expect(lineas[0]).toBe(['Nombre', 'Monto', 'Nota'].join(CSV_SEP))
    expect(lineas[1]).toBe(['Luz', '1000', ''].join(CSV_SEP))
  })

  it('empieza con BOM para que Excel no rompa los acentos', () => {
    expect(toCsv([], cols).startsWith(BOM)).toBe(true)
  })

  it('sin filas devuelve sólo el encabezado', () => {
    const csv = toCsv([], cols)
    expect(csv.replace(BOM, '').trim().split('\r\n')).toHaveLength(1)
  })

  it('tolera una lista nula', () => {
    expect(() => toCsv(null as any, cols)).not.toThrow()
  })

  it('separa filas con CRLF y termina con salto', () => {
    const csv = toCsv([
      { nombre: 'A', monto: 1, nota: null },
      { nombre: 'B', monto: 2, nota: null },
    ], cols)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv.replace(BOM, '').trim().split('\r\n')).toHaveLength(3)
  })

  it('escapa el contenido de las celdas, no sólo el encabezado', () => {
    const csv = toCsv([{ nombre: 'Luz; Gas', monto: 10.5, nota: 'dice "hola"' }], cols)
    expect(csv).toContain('"Luz; Gas"')
    expect(csv).toContain('10,5')
    expect(csv).toContain('"dice ""hola"""')
  })
})

describe('nombreArchivo', () => {
  it('arma el nombre con sufijo', () => {
    expect(nombreArchivo('gastos', '2026-06')).toBe('gastos-2026-06.csv')
  })

  it('sin sufijo no deja el guión colgando', () => {
    expect(nombreArchivo('reporte')).toBe('reporte.csv')
  })

  it('sanea los caracteres que Windows no acepta', () => {
    expect(nombreArchivo('gastos', '06/2026')).toBe('gastos-06-2026.csv')
    expect(nombreArchivo('a:b*c?d')).toBe('a-b-c-d.csv')
  })
})
