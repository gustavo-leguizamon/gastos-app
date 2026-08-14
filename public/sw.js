const CACHE_NAME = 'gastos-app-v3'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      await clients.claim()
    })()
  )
})

// --- Web Push -------------------------------------------------------------
// El payload lo arma `buildVencimientosPush` (src/lib/push-payload.ts) y llega como
// JSON: { title, body, url, tag }. Si viene vacío o ilegible se muestra un fallback,
// porque con `userVisibleOnly: true` el browser exige mostrar *algo*.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = {}
  }

  const title = data.title || 'GastosApp'
  const options = {
    body: data.body || 'Tenés vencimientos hoy',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'gastos-app',
    renotify: true,
    data: { url: data.url || '/gastos' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/gastos'

  event.waitUntil(
    (async () => {
      const all = await clients.matchAll({ type: 'window', includeUncontrolled: true })
      // Si la app ya está abierta, la enfocamos y navegamos ahí en vez de abrir otra pestaña.
      for (const client of all) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) await client.navigate(target).catch(() => {})
          return
        }
      }
      if (clients.openWindow) await clients.openWindow(target)
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/data/')) return

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match(req).then((cached) => cached || Response.error()))
  )
})
