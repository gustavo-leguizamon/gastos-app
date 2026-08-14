import { describe, it, expect } from 'vitest'
import { urlBase64ToUint8Array, toSubscribeBody } from './push-client'

describe('urlBase64ToUint8Array', () => {
  it('decodifica base64url sin padding', () => {
    // 'Ma' en base64url ("TWE") no tiene padding; con padding sería "TWE=".
    expect(Array.from(urlBase64ToUint8Array('TWE'))).toEqual([77, 97])
  })

  it('traduce - y _ a + y /', () => {
    // 0xFB 0xFF → base64 "+/8=" → base64url "-_8"
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([251, 255])
  })

  it('una clave VAPID real decodifica a los 65 bytes de una clave P-256 sin comprimir', () => {
    const key = 'BJciIFN1XEh1wCv6VQrfD6wtfjZG0216RO9hYhQK1JcXN2DzC7l5A-ZcD_yNRoHV84SZBjqSYcmc9HaX8HeE5B8'
    const bytes = urlBase64ToUint8Array(key)
    expect(bytes).toHaveLength(65)
    expect(bytes[0]).toBe(4) // prefijo de punto sin comprimir
  })
})

describe('toSubscribeBody', () => {
  it('extrae endpoint y claves del toJSON de la suscripción', () => {
    const sub = {
      endpoint: 'https://push.example/abc',
      toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'PPP', auth: 'AAA' } }),
    } as unknown as PushSubscription

    expect(toSubscribeBody(sub)).toEqual({
      endpoint: 'https://push.example/abc',
      p256dh: 'PPP',
      auth: 'AAA',
    })
  })

  it('cae al endpoint de la suscripción y a claves vacías si el toJSON viene incompleto', () => {
    const sub = {
      endpoint: 'https://push.example/xyz',
      toJSON: () => ({}),
    } as unknown as PushSubscription

    expect(toSubscribeBody(sub)).toEqual({
      endpoint: 'https://push.example/xyz',
      p256dh: '',
      auth: '',
    })
  })
})
