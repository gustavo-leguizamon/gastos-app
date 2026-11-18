import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fechaEnTimeZone } from '@/lib/fechas'
import { copiarGasto } from '@/lib/copiar-gasto'
import { debeAutocopiar, desdeAutocopia, periodoDestino } from '@/lib/tarjetas-autocopia'
import { tarjetaActivaEn } from '@/lib/tarjetas-baja'

/**
 * `GET /api/cron/copiar-tarjetas` — job diario que copia el resumen de cada tarjeta al mes
 * siguiente una vez pasada su fecha de cierre, igual que "Copiar" desde la grilla (sólo las
 * cuotas pendientes, con la cuota +1, y merge si el resumen del mes siguiente ya existe).
 *
 * Lo dispara Vercel Cron (ver `vercel.json`) en UTC: "hoy" se calcula en timezone Argentina.
 * Auth por `Authorization: Bearer $CRON_SECRET`, igual que `/api/cron/vencimientos`.
 *
 * Cada cierre se copia **una sola vez** (`TarjetaCierre.autoCopiadoAt`). Un cierre cuya
 * tarjeta no tiene resumen cargado en ese período no se marca: se reintenta mientras siga
 * dentro de la ventana (`VENTANA_AUTOCOPIA_DIAS`).
 *
 * Query params (para probar a mano):
 * - `today=YYYY-MM-DD` — fuerza la fecha en vez de calcularla.
 * - `dry=1` — lista lo que copiaría sin tocar nada.
 */

export const dynamic = 'force-dynamic'

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

interface Resultado {
  tarjeta: string
  origen: { mes: number; anio: number }
  destino: { mes: number; anio: number }
  gastos: number
  sub_items: number
  estado: 'copiado' | 'sin_resumen' | 'tarjeta_de_baja' | 'error' | 'dry'
  error?: string
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const override = searchParams.get('today')
  if (override && !FECHA_RE.test(override)) {
    return NextResponse.json({ error: 'today debe ser YYYY-MM-DD' }, { status: 400 })
  }
  const today = override ?? fechaEnTimeZone(new Date())
  const dry = searchParams.get('dry') === '1'

  const cierres = await prisma.tarjetaCierre.findMany({
    where: { autoCopiadoAt: null, fechaCierre: { gte: desdeAutocopia(today), lt: today } },
    include: { tarjeta: true },
    orderBy: [{ fechaCierre: 'asc' }, { id: 'asc' }],
  })

  const resultados: Resultado[] = []

  for (const cierre of cierres.filter(c => debeAutocopiar(c, today))) {
    const destino = periodoDestino(cierre)
    const base = {
      tarjeta: cierre.tarjeta.nombre,
      origen: { mes: cierre.mes, anio: cierre.anio },
      destino,
      gastos: 0,
      sub_items: 0,
    }

    // Una tarjeta dada de baja desde el mes destino no tiene resumen que proyectar.
    if (!tarjetaActivaEn(cierre.tarjeta, destino.mes, destino.anio)) {
      resultados.push({ ...base, estado: 'tarjeta_de_baja' })
      continue
    }

    // Puede haber un resumen por casa.
    const resumenes = await prisma.gasto.findMany({
      where: { esTarjeta: true, tarjetaId: cierre.tarjetaId, mes: cierre.mes, anio: cierre.anio },
      select: { id: true },
      orderBy: { id: 'asc' },
    })
    if (resumenes.length === 0) {
      resultados.push({ ...base, estado: 'sin_resumen' })
      continue
    }
    if (dry) {
      resultados.push({ ...base, gastos: resumenes.length, estado: 'dry' })
      continue
    }

    try {
      let subItems = 0
      for (const r of resumenes) {
        const res = await copiarGasto(r.id, destino.mes, destino.anio)
        if (res.status !== 'not_found') subItems += res.added_items
      }
      await prisma.tarjetaCierre.update({ where: { id: cierre.id }, data: { autoCopiadoAt: new Date() } })
      resultados.push({ ...base, gastos: resumenes.length, sub_items: subItems, estado: 'copiado' })
    } catch (e: any) {
      console.error('[cron copiar-tarjetas]', cierre.id, e)
      resultados.push({ ...base, estado: 'error', error: String(e?.message ?? e) })
    }
  }

  return NextResponse.json({
    ok: true,
    today,
    ...(dry ? { dry: true } : {}),
    copiados: resultados.filter(r => r.estado === 'copiado').length,
    resultados,
  })
}
