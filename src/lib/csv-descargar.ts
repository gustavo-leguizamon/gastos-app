// Disparo de la descarga en el browser. Separado de `csv.ts` (que es puro y testeable)
// porque toca `document`/`URL`, que no existen en el entorno de los tests.

/** Descarga `contenido` como archivo `nombre`. No-op fuera del browser. */
export function descargarCsv(nombre: string, contenido: string) {
  if (typeof document === 'undefined') return

  // `text/csv` con charset explícito; el BOM del contenido es lo que decide en Excel.
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Sin el revoke el blob queda retenido hasta que se recargue la página.
  URL.revokeObjectURL(url)
}
