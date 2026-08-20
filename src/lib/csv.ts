// Armado de CSV. La app no tenía forma de sacar los datos: ni gastos, ni reportes, ni
// sub-ítems. Todo lo que se cargó vivía sólo dentro de la app.
//
// Decisiones de formato, todas apuntadas a que el archivo **abra bien en Excel en español**,
// que es a dónde va a ir a parar:
// - Separador `;` en vez de `,`: con la configuración regional es-AR, Excel espera `;` y con
//   `,` mete toda la fila en una sola celda.
// - Números con **coma decimal** y sin separador de miles, que es como los lee Excel es-AR.
// - BOM UTF-8 al principio: sin él Excel interpreta el archivo como ANSI y rompe los acentos.

/** Separador de campos. Ver arriba: `;` por Excel en es-AR. */
export const CSV_SEP = ';'

/** Marca de orden de bytes UTF-8 — sin esto Excel muestra "Ma�ana" en vez de "Mañana". */
export const BOM = '﻿'

/** Definición de una columna: encabezado y cómo sacar el valor de la fila. */
export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined | boolean
}

/**
 * Escapa un valor de celda. Se entrecomilla si contiene el separador, comillas o saltos de
 * línea, y las comillas internas se duplican (regla estándar de CSV, RFC 4180).
 *
 * Los números se emiten con coma decimal; `null`/`undefined` quedan como celda vacía (no
 * como la cadena "null", que es lo que pasaría al concatenar sin más).
 */
export function escapeCsv(valor: string | number | null | undefined | boolean): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'

  let s: string
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return ''
    // Sin separador de miles y con coma decimal: `1234.5` → `1234,5`.
    s = String(valor).replace('.', ',')
  } else {
    s = valor
  }

  if (s.includes(CSV_SEP) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Serializa `rows` a CSV usando `columns`. Incluye el BOM y termina con salto de línea.
 * Las filas van separadas por CRLF, que es lo que espera Excel.
 */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map(c => escapeCsv(c.header)).join(CSV_SEP)
  const body = (rows ?? []).map(row => columns.map(c => escapeCsv(c.value(row))).join(CSV_SEP))
  return BOM + [head, ...body].join('\r\n') + '\r\n'
}

/**
 * Nombre de archivo con el período, saneado de todo lo que Windows no acepta en un nombre.
 * Ej: `gastos-2026-06.csv`.
 */
export function nombreArchivo(base: string, sufijo?: string): string {
  const limpio = [base, sufijo].filter(Boolean).join('-').replace(/[\\/:*?"<>|]/g, '-')
  return `${limpio}.csv`
}
