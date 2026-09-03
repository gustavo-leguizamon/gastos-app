// Baja de una tarjeta por período. Borrar la tarjeta que ya no se posee no es una opción:
// se lleva puestos los gastos que la usaron (`onDelete: Cascade`) y con ellos el histórico.
// La baja es entonces un corte temporal — "desde 08/2026 no la tengo más" — y la tarjeta
// desaparece de /gastos a partir de ese mes pero sigue completa en los meses anteriores,
// en /reportes y en /configuracion (donde se puede revertir).

/**
 * Forma mínima para decidir si una tarjeta sigue vigente en un período.
 *
 * Acepta el par en las **dos** convenciones del proyecto (ver "Naming convention mismatch"):
 * `bajaMes`/`bajaAnio` de las filas de Prisma y `baja_mes`/`baja_anio` de la API. Este módulo
 * es justo la costura entre las dos — lo llaman las routes con filas de Prisma y los
 * componentes con la respuesta de `/api/tarjetas` — así que la normalización vive acá una vez
 * en vez de repetirse como un `.map()` de adaptación en cada call site.
 */
export interface TarjetaBaja {
  bajaMes?: number | null
  bajaAnio?: number | null
  baja_mes?: number | null
  baja_anio?: number | null
}

/** Cuántos meses lleva un período desde el año 0, para poder compararlos con `<`/`>`. */
function periodoIndex(mes: number, anio: number): number {
  return anio * 12 + (mes - 1)
}

/** El período de baja en cualquiera de las dos convenciones, o `null` si no está completo. */
function periodoBaja(tarjeta: TarjetaBaja): { mes: number; anio: number } | null {
  const mes = tarjeta.bajaMes ?? tarjeta.baja_mes ?? null
  const anio = tarjeta.bajaAnio ?? tarjeta.baja_anio ?? null
  return mes == null || anio == null ? null : { mes, anio }
}

/**
 * Si la tarjeta sigue vigente en `(mes, anio)`.
 *
 * El mes configurado **ya cuenta como de baja** (`>=`, no `>`): "deshabilitar en agosto"
 * quiere decir que en agosto no aparece más, no que agosto es el último mes en que aparece.
 * Sin período de baja (o con uno a medio cargar) la tarjeta está activa — la baja se aplica
 * sólo cuando el corte está completo, para no esconder una tarjeta por un dato parcial.
 */
export function tarjetaActivaEn(tarjeta: TarjetaBaja, mes: number, anio: number): boolean {
  const baja = periodoBaja(tarjeta)
  if (!baja) return true
  return periodoIndex(mes, anio) < periodoIndex(baja.mes, baja.anio)
}

/** Las tarjetas vigentes en `(mes, anio)`, conservando el orden de entrada. */
export function tarjetasActivasEn<T extends TarjetaBaja>(tarjetas: T[], mes: number, anio: number): T[] {
  return (tarjetas ?? []).filter(t => tarjetaActivaEn(t, mes, anio))
}

/**
 * Las tarjetas que un select de /gastos debe ofrecer en `(mes, anio)`: las vigentes **más**
 * las de `conservarIds` que hayan quedado afuera por la baja.
 *
 * Ese rescate no es un detalle: una tarjeta ya elegida que desaparece de las opciones se
 * pierde sin aviso — el form la guardaría en `null` al editar un gasto viejo, y el filtro
 * quedaría aplicado sin nada que lo muestre. La baja saca de la lista lo que no se puede
 * elegir de nuevo, no lo que ya está elegido.
 */
export function tarjetasVisiblesEn<T extends TarjetaBaja & { id: number }>(
  tarjetas: T[],
  mes: number,
  anio: number,
  conservarIds: readonly number[] = [],
): T[] {
  return (tarjetas ?? []).filter(
    t => tarjetaActivaEn(t, mes, anio) || conservarIds.includes(t.id),
  )
}

/**
 * Normaliza el período de baja que llega en el body de `POST`/`PUT /api/tarjetas`.
 *
 * Es todo o nada: un mes sin año (o al revés) no define un corte, así que se guarda `null`
 * en los dos en vez de un período a medias que después nadie sabe interpretar. Un mes fuera
 * de `1..12` o un año no entero se descarta igual. Devolver la baja limpia ante cualquier
 * cosa inválida es también el camino para **revertir** la baja desde la UI.
 */
export function parseBaja(mes: unknown, anio: unknown): { bajaMes: number | null; bajaAnio: number | null } {
  const sinBaja = { bajaMes: null, bajaAnio: null }
  const m = Number(mes)
  const a = Number(anio)
  if (!Number.isInteger(m) || m < 1 || m > 12) return sinBaja
  if (!Number.isInteger(a) || a < 1900 || a > 9999) return sinBaja
  return { bajaMes: m, bajaAnio: a }
}
