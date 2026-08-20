import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { toGastoResponse } from '@/lib/gastos-compute'
import { vencimientosPendientes } from '@/lib/vencimientos'
import { buildVencimientosPush } from '@/lib/push-payload'
import { sendPushToAll, vapidConfigured } from '@/lib/push'
import { fechaEnTimeZone, shiftMonth } from '@/lib/fechas'

/**
 * `GET /api/cron/vencimientos` — job diario que manda el push de los vencimientos del día.
 *
 * Lo dispara Vercel Cron (ver `vercel.json`), que corre en **UTC**: la fecha de "hoy" se
 * calcula en timezone Argentina, no con la fecha local del server.
 *
 * Auth por `Authorization: Bearer $CRON_SECRET` (header que Vercel manda solo si la env
 * var `CRON_SECRET` está definida) — esta ruta está exceptuada del middleware de sesión.
 *
 * Query params (para probar a mano):
 * - `today=YYYY-MM-DD` — fuerza la fecha en vez de calcularla.
 * - `dry=1` — calcula y devuelve el payload sin mandar nada.
 */

export const dynamic = 'force-dynamic'

const INCLUDE = {
  casa: true,
  moneda: true,
  tarjeta: { include: { cierres: true } },
  concepto: true,
  categoria: true,
  etiquetas: true,
  pagos: { orderBy: { createdAt: 'asc' as const } },
  items: { orderBy: { createdAt: 'asc' as const }, include: { concepto: true, categoria: true, etiquetas: true } },
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

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

  const [anio, mes] = today.split('-').map(Number)
  const prev = shiftMonth(mes, anio, -1)

  // Se miran el mes corriente y el anterior. El corriente trae los vencimientos de hoy;
  // el anterior existe para que un atraso de fin de mes no desaparezca el día 1 sólo
  // porque cambió el período — que era justamente el agujero del aviso "sólo hoy".
  const gastos = await prisma.gasto.findMany({
    where: { OR: [{ mes, anio }, { mes: prev.mes, anio: prev.anio }] },
    include: INCLUDE,
    orderBy: [{ fechaVencimiento: 'asc' }, { id: 'asc' }],
  })

  const pendientes = vencimientosPendientes(gastos.map(toGastoResponse), today)
  const payload = buildVencimientosPush(pendientes)

  const vencidos = pendientes.filter(v => v.estado === 'vencido').length

  if (!payload) {
    return NextResponse.json({ ok: true, today, vencimientos: 0, vencidos: 0, enviadas: 0 })
  }
  if (dry) {
    return NextResponse.json({ ok: true, today, vencimientos: pendientes.length, vencidos, dry: true, payload })
  }
  if (!vapidConfigured()) {
    return NextResponse.json({ error: 'Faltan las claves VAPID en el servidor' }, { status: 500 })
  }

  const subs = await prisma.pushSubscription.findMany()
  const results = await sendPushToAll(subs, payload)

  // Las suscripciones que el push service da por muertas se borran: si no, el job
  // arrastra endpoints inválidos para siempre.
  const gone = results.filter(r => r.gone).map(r => r.endpoint)
  if (gone.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: gone } } })
  }

  return NextResponse.json({
    ok: true,
    today,
    vencimientos: pendientes.length,
    vencidos,
    enviadas: results.filter(r => r.ok).length,
    eliminadas: gone.length,
    errores: results.filter(r => !r.ok && !r.gone).map(r => r.error),
  })
}
