import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Suscripciones Web Push del usuario logueado.
 *
 * - `POST`   — guarda (o reasigna) la suscripción del browser actual. Body:
 *              `{ endpoint, p256dh, auth }`. El `endpoint` es la identidad: si el browser
 *              renueva las claves sobre el mismo endpoint, se actualizan en vez de duplicar.
 * - `DELETE` — borra la suscripción de este browser. Body: `{ endpoint }`.
 * - `GET`    — `{ subscriptions: n }` para que la UI sepa si hay alguna registrada.
 */

async function requireEmail() {
  const session = await getServerSession(authOptions)
  return session?.user?.email?.toLowerCase() ?? null
}

export async function GET() {
  const email = await requireEmail()
  if (!email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const subscriptions = await prisma.pushSubscription.count({ where: { email } })
  return NextResponse.json({ subscriptions })
}

export async function POST(req: NextRequest) {
  const email = await requireEmail()
  if (!email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : ''
  const p256dh = typeof body?.p256dh === 'string' ? body.p256dh : ''
  const auth = typeof body?.auth === 'string' ? body.auth : ''
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Suscripción inválida: faltan endpoint/p256dh/auth' }, { status: 400 })
  }

  const userAgent = req.headers.get('user-agent')
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { email, endpoint, p256dh, auth, userAgent },
    update: { email, p256dh, auth, userAgent },
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const email = await requireEmail()
  if (!email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : ''
  if (!endpoint) return NextResponse.json({ error: 'Falta endpoint' }, { status: 400 })

  // Filtra por email también: un usuario no puede desuscribir el device de otro.
  const { count } = await prisma.pushSubscription.deleteMany({ where: { endpoint, email } })
  return NextResponse.json({ ok: true, deleted: count })
}
