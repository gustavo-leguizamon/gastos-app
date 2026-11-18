// Copia automática del resumen de tarjeta al mes siguiente, una vez pasada la fecha de cierre.
//
// Cuando el resumen del período M cierra, lo que queda por delante son las cuotas pendientes
// que van a aparecer en M+1. Hasta ahora eso se hacía a mano con "Copiar"; el cron
// `GET /api/cron/copiar-tarjetas` lo hace solo usando exactamente la misma lógica
// (`copiarGasto`), y este módulo decide **qué** cierres toca copiar hoy.

import { diasEntre, shiftMonth } from './fechas'

/**
 * Días hacia atrás que el cron mira. Un cierre que pasó hace más que esto no se copia: evita
 * que, al habilitar la función, se copie todo el histórico de golpe, y da margen para que un
 * cron que no corrió algún día (Vercel Hobby no garantiza el minuto) lo agarre al siguiente.
 */
export const VENTANA_AUTOCOPIA_DIAS = 10

export interface CierreAutocopia {
  mes: number
  anio: number
  fechaCierre: string | null
  autoCopiadoAt?: Date | string | null
}

/**
 * Fecha `YYYY-MM-DD` desde la que el cron busca cierres (`today - ventana`), para pre-filtrar
 * en la DB. La comparación lexicográfica sobre `YYYY-MM-DD` es cronológica.
 */
export function desdeAutocopia(today: string, ventana: number = VENTANA_AUTOCOPIA_DIAS): string {
  const [y, m, d] = today.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d, 12) - ventana * 86_400_000)
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

/**
 * Si el resumen de este cierre corresponde copiarlo hoy al mes siguiente:
 * - la `fechaCierre` **ya pasó** (estrictamente: el día del cierre todavía acumula consumos),
 * - hace como mucho `ventana` días,
 * - y todavía no se copió automáticamente (`autoCopiadoAt` en null) — la copia es una sola
 *   vez: si después se borra algo de lo copiado, el cron no lo vuelve a poner.
 */
export function debeAutocopiar(
  cierre: CierreAutocopia,
  today: string,
  ventana: number = VENTANA_AUTOCOPIA_DIAS,
): boolean {
  if (cierre.autoCopiadoAt) return false
  if (!cierre.fechaCierre) return false
  const dias = diasEntre(cierre.fechaCierre, today)
  return dias !== null && dias >= 1 && dias <= ventana
}

/** Período al que se copia el resumen de un cierre: el mes siguiente. */
export function periodoDestino(cierre: { mes: number; anio: number }): { mes: number; anio: number } {
  return shiftMonth(cierre.mes, cierre.anio, 1)
}
