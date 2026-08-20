// Parte pura de Sueldos: quién puede verla, a qué período se imputa y el cálculo de
// Neto/Bruto. Sin imports de next-auth a propósito — `TopBar` es un client component y
// necesita `emailPuedeVerSueldos`; si eso viviera junto a `getServerSession`, el bundle del
// browser se llevaría código de servidor puesto.

import { mesAnioDeFecha } from './ingresos-compute'

/**
 * Emails con acceso a Sueldos, desde `NEXT_PUBLIC_SUELDOS_EMAILS` (coma-separada, mismo
 * formato que `ALLOWED_EMAILS`).
 *
 * Antes era una constante hardcodeada y encima duplicada en `TopBar`: cambiar de cuenta
 * obligaba a tocar código en dos archivos y redeployar.
 *
 * Es `NEXT_PUBLIC_` porque `TopBar` decide en el cliente si muestra el ítem del menú, así
 * que la lista viaja en el bundle. **No es el control de acceso**: eso lo hacen los 403 de
 * las routes (`isSueldosAllowed`, contra la sesión del server) y el `router.replace` de la
 * página. Acá sólo se decide a quién se le muestra el link.
 *
 * Sin la env var no la ve nadie (lista vacía): ante config faltante, la sección con los
 * datos más sensibles se cierra, no se abre.
 */
export function sueldosEmails(): string[] {
  return (process.env.NEXT_PUBLIC_SUELDOS_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

/** `true` si el email está habilitado para Sueldos. */
export function emailPuedeVerSueldos(email: string | null | undefined): boolean {
  if (!email) return false
  return sueldosEmails().includes(email.trim().toLowerCase())
}

/**
 * Período (`mes`/`anio`) al que se imputa un sueldo: los del body si vienen, si no derivados
 * de `fecha`. Así el form puede seguir mandando sólo la fecha, pero queda abierta la puerta
 * a imputar a otro mes (un cobro del 31/7 que corresponde a agosto).
 *
 * `mesAnioDeFecha` parsea el string sin `new Date()`, que interpretaría `YYYY-MM-DD` como UTC
 * y correría el mes en Argentina para un cobro del día 1 o del último día.
 */
export function periodoDe(body: any): { mes: number; anio: number } {
  const mes = Number(body?.mes)
  const anio = Number(body?.anio)
  if (Number.isInteger(mes) && mes >= 1 && mes <= 12 && Number.isInteger(anio) && anio >= 1900 && anio <= 2999) {
    return { mes, anio }
  }
  // Sin período ni fecha válida, 1/2000 es evidentemente incorrecto y salta a la vista en la
  // pantalla, en vez de imputar en silencio al mes actual y quedar mal sin que se note.
  return mesAnioDeFecha(body?.fecha) ?? { mes: 1, anio: 2000 }
}

/**
 * Proporción del bruto que representa el neto pagado. El bruto se muestra como
 * `neto / 0.83`, es decir "cuánto sería el bruto si lo cobrado es el 83%".
 */
export const FACTOR_NETO_BRUTO = 0.83

export interface SueldoCalculable {
  sueldo_ars: number
  sueldo_usd: number
  cotizacion_mep: number
  sueldo_teorico?: number
}

/**
 * `neto = ars + usd × cotizacion_mep`, y `bruto = neto / 0.83`.
 *
 * El tramo en dólares se valúa al **MEP**, que es la cotización a la que efectivamente se
 * puede vender. `cotizacion_bna` se guarda por referencia pero no entra en la cuenta.
 */
export function calcularSueldo(s: SueldoCalculable) {
  const neto = s.sueldo_ars + s.sueldo_usd * s.cotizacion_mep
  return { neto, bruto: neto / FACTOR_NETO_BRUTO }
}

/**
 * `true` si el bruto calculado alcanza al teórico — es lo que decide si la celda va en verde
 * o en rojo. Sin teórico cargado (0) no hay comparación posible y se devuelve `null`.
 */
export function alcanzaTeorico(s: SueldoCalculable): boolean | null {
  const teorico = s.sueldo_teorico ?? 0
  if (teorico <= 0) return null
  return calcularSueldo(s).bruto >= teorico
}
