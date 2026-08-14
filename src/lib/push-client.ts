// Helpers de la suscripción push del lado del browser. La conversión de la clave VAPID
// vive acá (y no en el componente) para poder testearla sin DOM.

/**
 * La clave pública VAPID viaja como base64url (sin padding, con `-` y `_`), pero
 * `pushManager.subscribe` pide un `Uint8Array` de bytes crudos.
 */
export function urlBase64ToUint8Array(base64UrlKey: string): Uint8Array {
  const padding = '='.repeat((4 - (base64UrlKey.length % 4)) % 4)
  const base64 = (base64UrlKey + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary')
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** Body que espera `POST /api/push/subscribe` a partir de una `PushSubscription` del browser. */
export function toSubscribeBody(sub: PushSubscription): { endpoint: string; p256dh: string; auth: string } {
  const json = sub.toJSON()
  return {
    endpoint: json.endpoint ?? sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  }
}
