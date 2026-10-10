// Formateo compartido de la sección Divisas. Vive aparte porque las cards, el gráfico y la
// grilla tienen que mostrar los mismos números igual: si cada uno redondea a su manera, la
// suma de la grilla deja de coincidir con el tile de arriba.

/** Pesos, siempre con dos decimales: `$ 1.234,56`. */
export function fmtArs(n: number): string {
  return `$ ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`
}

/**
 * Divisa, con hasta ocho decimales. El mínimo es 2 (un saldo en dólares se lee `US$ 100,00`)
 * y el máximo 8 para no truncar una tenencia en cripto, que se mueve en fracciones mucho más
 * chicas que un centavo.
 */
export function fmtDivisa(n: number, simbolo = 'US$'): string {
  return `${simbolo} ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(n)}`
}

/** `+12,34%` / `-5%`. `null` (sin base contra la cual medir) se muestra como `—`. */
export function fmtPct(n: number | null): string {
  if (n === null) return '—'
  const signo = n > 0 ? '+' : ''
  return `${signo}${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)}%`
}

/** Monto con signo explícito adelante cuando es positivo, para que se lea como resultado. */
export function fmtConSigno(n: number, fmt: (v: number) => string): string {
  return `${n > 0 ? '+' : ''}${fmt(n)}`
}

/** Verde si ganó, rojo si perdió, neutro en cero. `null` = sin dato. */
export function colorResultado(n: number | null): string {
  if (n === null || n === 0) return 'text.primary'
  return n > 0 ? 'success.main' : 'error.main'
}

/** `2026-06-10` → `10/06`. La fecha se parte como string: `new Date()` correría el día. */
export function labelFecha(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  return m ? `${m[3]}/${m[2]}` : fecha
}
