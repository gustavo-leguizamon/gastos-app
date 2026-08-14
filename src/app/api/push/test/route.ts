import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendPushToAll, vapidConfigured } from '@/lib/push'
import { TAG_VENCIMIENTOS } from '@/lib/push-payload'

/**
 * `POST /api/push/test` — manda una notificación de prueba a todos los devices del
 * usuario logueado. Sirve para verificar que el permiso, el service worker y las
 * claves VAPID están bien antes de esperar al cron de la mañana.
 * Borra las suscripciones que el push service reporta como muertas (404/410).
 */
export async function POST() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email?.toLowerCase()
  if (!email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (!vapidConfigured()) {
    return NextResponse.json({ error: 'Faltan las claves VAPID en el servidor' }, { status: 500 })
  }

  const subs = await prisma.pushSubscription.findMany({ where: { email } })
  if (subs.length === 0) {
    return NextResponse.json({ error: 'No hay devices suscriptos' }, { status: 404 })
  }

  const results = await sendPushToAll(subs, {
    title: 'Notificación de prueba',
    body: 'Si ves esto, los avisos de vencimientos van a llegar bien.',
    url: '/gastos',
    tag: TAG_VENCIMIENTOS,
  })

  const gone = results.filter(r => r.gone).map(r => r.endpoint)
  if (gone.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: gone } } })
  }

  return NextResponse.json({
    ok: results.some(r => r.ok),
    enviadas: results.filter(r => r.ok).length,
    eliminadas: gone.length,
    errores: results.filter(r => !r.ok && !r.gone).map(r => r.error),
  })
}
