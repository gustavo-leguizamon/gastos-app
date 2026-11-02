// Lógica pura de la comparación de plataformas para comprar divisa.
//
// Cada plataforma guarda sólo lo que el usuario tipea (cotización a la que vende y comisión).
// Cuánta divisa entrega por un monto, a cuánto sale realmente cada unidad y cuál conviene se
// derivan acá: cambian con el monto (una comisión fija pesa más en una compra chica), así que
// no pueden persistirse.
//
// Sin imports de Prisma/Next.

import type { PlataformaDivisa } from './types'

export type ComisionTipo = 'PORCENTAJE' | 'FIJA'

export interface PlataformaData {
  nombre: string
  monedaId: number
  cotizacion: number
  comisionTipo: ComisionTipo
  comision: number
  comisionMoneda: 'ARS' | 'DIVISA'
  nota: string | null
  activa: boolean
}

const sinCeroNegativo = (n: number) => (n === 0 ? 0 : n)
const r2 = (n: number) => sinCeroNegativo(Math.round(n * 100) / 100)
const r8 = (n: number) => sinCeroNegativo(Math.round(n * 1e8) / 1e8)

export interface ResultadoPlataforma {
  plataforma: PlataformaDivisa
  /** Divisa que queda **neta de comisión** al gastar `monto_ars`. `null` si no alcanza. */
  divisa_obtenida: number | null
  /** Pesos que costó cada unidad con la comisión adentro (`monto / divisa_obtenida`). */
  cotizacion_efectiva: number | null
  /** Lo que se llevó la comisión, en pesos (la comisión en divisa se valúa a la cotización). */
  comision_ars: number | null
  /** Cuánto más cara es respecto de la mejor, en % sobre la efectiva. 0 en la mejor. */
  sobrecosto_pct: number | null
  /** Divisa que se deja de recibir respecto de la mejor. 0 en la mejor. */
  divisa_menos: number | null
  es_mejor: boolean
}

/**
 * Qué entrega una plataforma por `montoArs` pesos. `null` si el monto no alcanza para cubrir
 * la comisión (o los datos no sirven).
 *
 * El monto es **lo que sale de la cuenta**: una comisión en pesos se descuenta de él antes de
 * comprar (`X = Q·c·(1+p)` ⇒ `Q = X / (c·(1+p))`), mientras que una comisión en divisa se
 * resta de lo comprado.
 */
export function entregaPlataforma(
  p: Pick<PlataformaDivisa, 'cotizacion' | 'comision_tipo' | 'comision' | 'comision_moneda'>,
  montoArs: number,
): { divisa: number; comision_ars: number } | null {
  if (!Number.isFinite(montoArs) || montoArs <= 0) return null
  if (!Number.isFinite(p.cotizacion) || p.cotizacion <= 0) return null

  const c = p.cotizacion
  const com = Number.isFinite(p.comision) && p.comision > 0 ? p.comision : 0
  const fija = p.comision_tipo === 'FIJA'
  const pct = com / 100

  let divisa: number
  let comisionArs: number
  if (p.comision_moneda === 'DIVISA') {
    const bruta = montoArs / c
    const comisionDivisa = fija ? com : bruta * pct
    divisa = bruta - comisionDivisa
    comisionArs = comisionDivisa * c
  } else if (fija) {
    divisa = (montoArs - com) / c
    comisionArs = com
  } else {
    divisa = montoArs / (c * (1 + pct))
    comisionArs = montoArs - divisa * c
  }

  if (!(divisa > 0)) return null
  return { divisa: r8(divisa), comision_ars: r2(comisionArs) }
}

/**
 * Compara las plataformas para un mismo monto. Devuelve **de mejor a peor**: la que entrega
 * más divisa primero y, al final, las que no alcanzan. Con empate exacto ambas son `es_mejor`.
 */
export function compararPlataformas(plataformas: PlataformaDivisa[], montoArs: number): ResultadoPlataforma[] {
  const calculadas = (plataformas ?? []).map((plataforma) => ({
    plataforma,
    e: entregaPlataforma(plataforma, montoArs),
  }))

  const validas = calculadas
    .filter((x): x is { plataforma: PlataformaDivisa; e: { divisa: number; comision_ars: number } } => x.e !== null)
    .sort((a, b) => b.e.divisa - a.e.divisa || a.plataforma.nombre.localeCompare(b.plataforma.nombre))
  const mejor = validas.length > 0 ? validas[0].e.divisa : 0

  const out: ResultadoPlataforma[] = validas.map(({ plataforma, e }) => ({
    plataforma,
    divisa_obtenida: e.divisa,
    cotizacion_efectiva: r2(montoArs / e.divisa),
    comision_ars: e.comision_ars,
    // Sobre la efectiva: (X/d) / (X/mejor) - 1 = mejor/d - 1.
    sobrecosto_pct: sinCeroNegativo(Math.round((mejor / e.divisa - 1) * 10000) / 100),
    divisa_menos: r8(mejor - e.divisa),
    es_mejor: e.divisa === mejor,
  }))

  const invalidas: ResultadoPlataforma[] = calculadas
    .filter((x) => x.e === null)
    .map(({ plataforma }) => ({
      plataforma,
      divisa_obtenida: null,
      cotizacion_efectiva: null,
      comision_ars: null,
      sobrecosto_pct: null,
      divisa_menos: null,
      es_mejor: false,
    }))

  return [...out, ...invalidas]
}

function texto(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

/** Valida y normaliza el body de `/api/divisas/plataformas`. `null` ⇒ 400. */
export function parsePlataformaBody(body: any): PlataformaData | null {
  if (!body || typeof body !== 'object') return null

  const nombre = texto(body.nombre)
  if (!nombre) return null

  const monedaId = Number(body.moneda_id)
  if (!Number.isInteger(monedaId) || monedaId <= 0) return null

  const cotizacion = Number(body.cotizacion)
  if (!Number.isFinite(cotizacion) || cotizacion <= 0) return null

  const comisionTipo: ComisionTipo = body.comision_tipo === 'FIJA' ? 'FIJA' : 'PORCENTAJE'
  const comision = body.comision == null || body.comision === '' ? 0 : Number(body.comision)
  // Una comisión negativa sería una bonificación, y un % >= 100 se come toda la compra.
  if (!Number.isFinite(comision) || comision < 0) return null
  if (comisionTipo === 'PORCENTAJE' && comision >= 100) return null

  return {
    nombre,
    monedaId,
    cotizacion,
    comisionTipo,
    comision,
    comisionMoneda: body.comision_moneda === 'DIVISA' ? 'DIVISA' : 'ARS',
    nota: texto(body.nota),
    activa: body.activa !== false,
  }
}

/** Mapping camelCase (Prisma) → snake_case (API). */
export function toPlataformaResponse(row: any): PlataformaDivisa {
  return {
    id: row.id,
    nombre: row.nombre,
    moneda_id: row.monedaId,
    cotizacion: row.cotizacion,
    comision_tipo: row.comisionTipo === 'FIJA' ? 'FIJA' : 'PORCENTAJE',
    comision: row.comision,
    comision_moneda: row.comisionMoneda === 'DIVISA' ? 'DIVISA' : 'ARS',
    nota: row.nota ?? null,
    activa: row.activa !== false,
    updated_at: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt ?? ''),
  }
}
