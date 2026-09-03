// Generación del cierre de tarjeta del período siguiente. Los `TarjetaCierre` se cargaban
// a mano, mes por mes, aunque el dato para derivarlos ya estuviera guardado: el cierre de un
// mes trae `fechaProximoCierre`, que es exactamente la `fechaCierre` del que sigue. Olvidarse
// de cargarlo no es cosmético — sin cierre del mes, `POST /api/gastos/[id]/pagos` responde
// 400 y la propagación del pago a la tarjeta se rompe.

import { diasEntre, shiftMonth } from './fechas'
import { ultimoDiaDelMes } from './mover-periodo'

/** Forma mínima de un cierre para poder proyectar el siguiente. */
export interface CierreBase {
  mes: number
  anio: number
  fechaCierre: string | null
  fechaVencimiento: string | null
  fechaProximoCierre: string | null
}

export interface CierreGenerado {
  mes: number
  anio: number
  fechaCierre: string | null
  fechaVencimiento: string | null
  fechaProximoCierre: string | null
}

/**
 * Suma `n` meses a una fecha `YYYY-MM-DD` conservando el día, recortado al último del mes
 * destino (31 de enero + 1 mes → 28/29 de febrero). `null` si la fecha no es válida.
 */
export function addMeses(fecha: string | null, n: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha ?? '')
  if (!m) return null
  const destino = shiftMonth(Number(m[2]), Number(m[1]), n)
  const dia = Math.min(Number(m[3]), ultimoDiaDelMes(destino.mes, destino.anio))
  return `${destino.anio}-${String(destino.mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/**
 * Proyecta el cierre del período siguiente a partir del `ultimo` cargado.
 *
 * La regla que hace todo esto derivable: **`fechaProximoCierre` de un período es la
 * `fechaCierre` del siguiente** — no se inventa nada, es el mismo dato con otro nombre.
 * Si el último no la tiene cargada, se cae a `fechaCierre + 1 mes`.
 *
 * El vencimiento y el próximo cierre se corren un mes conservando el día, que es como se
 * comportan los ciclos de tarjeta. Todo sale nullable: si el último cierre está incompleto,
 * el generado también lo estará y se completa a mano — es preferible a inventar una fecha.
 */
export function generarSiguienteCierre(ultimo: CierreBase): CierreGenerado {
  const periodo = shiftMonth(ultimo.mes, ultimo.anio, 1)
  const fechaCierre = ultimo.fechaProximoCierre ?? addMeses(ultimo.fechaCierre, 1)

  return {
    mes: periodo.mes,
    anio: periodo.anio,
    fechaCierre,
    fechaVencimiento: addMeses(ultimo.fechaVencimiento, 1),
    fechaProximoCierre: addMeses(fechaCierre, 1),
  }
}

/**
 * El cierre más reciente de una lista (mayor `anio`, luego mayor `mes`). `null` si está vacía.
 * No se confía en el orden en el que vienen.
 */
export function ultimoCierre<T extends { mes: number; anio: number }>(cierres: T[]): T | null {
  if (!cierres?.length) return null
  return cierres.reduce((max, c) =>
    c.anio > max.anio || (c.anio === max.anio && c.mes > max.mes) ? c : max,
  )
}

/**
 * Estado del ciclo de una tarjeta respecto de `today`:
 * - `cerrado`: el próximo cierre ya pasó — el resumen del período está cerrado.
 * - `abierto`: todavía no cerró (el día del cierre cuenta como abierto, igual que el
 *   filtro `fechaProximoCierre < today` que tenía la sección antes de mostrar las abiertas).
 * - `por_cerrar`: no hay `fechaProximoCierre`, pero la `fechaCierre` del período todavía no
 *   llegó — el resumen de este período sigue acumulando y cierra en `dias`. Es el único caso
 *   sin próximo cierre del que igual se puede decir algo.
 * - `sin_fecha`: no hay `fechaProximoCierre` y la `fechaCierre` ya pasó (o no hay ninguna
 *   fecha válida) — no se puede decir nada del ciclo.
 */
export type EstadoCiclo = 'cerrado' | 'abierto' | 'por_cerrar' | 'sin_fecha'

export interface CicloTarjeta {
  estado: EstadoCiclo
  /**
   * Días completos de hoy al cierre que la tarjeta tiene por delante: el `fechaProximoCierre`
   * en `cerrado`/`abierto`, la propia `fechaCierre` en `por_cerrar`. `0` = cierra hoy,
   * negativo = ya cerró (sólo posible en `cerrado`).
   */
  dias: number | null
  /** Fracción `0..1` del ciclo que termina en ese cierre ya transcurrida. */
  progreso: number | null
}

/**
 * Cuánto le falta a una tarjeta para cerrar, para poder mostrar juntas las que ya cerraron
 * y las que no. El ciclo que se mide es `fechaCierre → fechaProximoCierre`: el que va
 * acumulando los consumos del resumen que viene.
 *
 * `progreso` queda en `null` cuando el cierre está incompleto o las fechas no forman un
 * intervalo válido (`fechaProximoCierre <= fechaCierre`) — un cierre a medio cargar no
 * habilita a inventar una barra, pero `dias` sigue siendo utilizable si hay próximo cierre.
 */
export function estadoCiclo(
  cierre: { fechaCierre: string | null; fechaProximoCierre: string | null } | null | undefined,
  today: string,
): CicloTarjeta {
  const dias = cierre?.fechaProximoCierre ? diasEntre(today, cierre.fechaProximoCierre) : null
  if (dias === null) return cicloPorCerrar(cierre?.fechaCierre ?? null, today)

  const total = cierre?.fechaCierre ? diasEntre(cierre.fechaCierre, cierre.fechaProximoCierre!) : null
  const transcurrido = cierre?.fechaCierre ? diasEntre(cierre.fechaCierre, today) : null
  const progreso =
    total !== null && total > 0 && transcurrido !== null
      ? Math.min(1, Math.max(0, transcurrido / total))
      : null

  return { estado: dias < 0 ? 'cerrado' : 'abierto', dias, progreso }
}

/**
 * Sin `fechaProximoCierre` no se puede medir el ciclo que viene, pero si la `fechaCierre` del
 * período todavía no llegó sí se puede medir **el ciclo actual**: el resumen está abierto y
 * cierra en esa fecha. Antes esto caía en `sin_fecha` junto con los cierres que no tienen
 * ninguna fecha, así que la tarjeta se mostraba como "sin cierre cargado" teniendo el dato.
 *
 * El inicio del ciclo es el cierre anterior, que por definición no está cargado: se deriva
 * como `fechaCierre - 1 mes`, la misma suposición de ciclo mensual que ya hace
 * `generarSiguienteCierre`. Si la `fechaCierre` ya pasó no queda nada que medir y vuelve a
 * `sin_fecha` — que es exactamente como se venía mostrando.
 */
function cicloPorCerrar(fechaCierre: string | null, today: string): CicloTarjeta {
  const dias = fechaCierre ? diasEntre(today, fechaCierre) : null
  if (dias === null || dias < 0) return { estado: 'sin_fecha', dias: null, progreso: null }

  const inicio = addMeses(fechaCierre, -1)
  const total = inicio ? diasEntre(inicio, fechaCierre!) : null
  const transcurrido = inicio ? diasEntre(inicio, today) : null
  const progreso =
    total !== null && total > 0 && transcurrido !== null
      ? Math.min(1, Math.max(0, transcurrido / total))
      : null

  return { estado: 'por_cerrar', dias, progreso }
}
