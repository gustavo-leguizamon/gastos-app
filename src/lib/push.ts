// Envío de Web Push (server-only). Wrapper fino sobre `web-push` para que las routes
// no toquen la librería directamente: configura VAPID una sola vez y normaliza el
// resultado de cada envío (en particular las suscripciones muertas, que hay que borrar).

import webpush from 'web-push'
import type { PushPayload } from './push-payload'

/** Forma mínima de una fila de `PushSubscription` que necesita el envío. */
export interface PushSubscriptionLike {
  endpoint: string
  p256dh: string
  auth: string
}

export interface SendPushResult {
  endpoint: string
  ok: boolean
  /** El push service dice que la suscripción ya no existe (404/410) → hay que borrarla. */
  gone: boolean
  statusCode?: number
  error?: string
}

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
const privateKey = process.env.VAPID_PRIVATE_KEY ?? ''
// El subject identifica al remitente ante el push service; tiene que ser mailto: o https:.
const subject = process.env.VAPID_SUBJECT ?? 'mailto:gastos-app@localhost'

/** `true` si están las dos claves VAPID — sin ellas no se puede mandar nada. */
export function vapidConfigured(): boolean {
  return Boolean(publicKey && privateKey)
}

let configured = false
function configure() {
  if (configured) return
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

/**
 * Manda un push a una suscripción. Nunca tira: los errores vuelven en el resultado
 * para que un endpoint caído no aborte el resto del batch.
 */
export async function sendPush(sub: PushSubscriptionLike, payload: PushPayload): Promise<SendPushResult> {
  if (!vapidConfigured()) {
    return { endpoint: sub.endpoint, ok: false, gone: false, error: 'VAPID keys no configuradas' }
  }
  configure()

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    )
    return { endpoint: sub.endpoint, ok: true, gone: false }
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode
    return {
      endpoint: sub.endpoint,
      ok: false,
      gone: statusCode === 404 || statusCode === 410,
      statusCode,
      error: (err as Error).message,
    }
  }
}

/** Manda el mismo push a todas las suscripciones, en paralelo. */
export async function sendPushToAll(
  subs: PushSubscriptionLike[],
  payload: PushPayload,
): Promise<SendPushResult[]> {
  return Promise.all(subs.map(s => sendPush(s, payload)))
}
