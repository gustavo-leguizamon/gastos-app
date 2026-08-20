# Auth y PWA

## Authentication

Toda la app está detrás de login con Google vía **NextAuth v4** (estrategia JWT, sin tabla de usuarios en la DB).

- `src/lib/auth.ts` — define `authOptions` con `GoogleProvider` y un callback `signIn` que sólo permite emails listados en `ALLOWED_EMAILS` (env var, coma-separada, normalizada a lowercase). Si la lista está vacía nadie puede entrar.
- `src/app/api/auth/[...nextauth]/route.ts` — handler standard de NextAuth para App Router.
- `middleware.ts` (raíz del repo) — usa el middleware default de `next-auth/middleware` para forzar sesión en **todas** las rutas, exceptuando `api/auth/*`, `/login`, el manifest/SW/íconos PWA, favicon y assets de `_next`. Si no hay sesión, redirige a `/login`.
- `src/app/login/page.tsx` — pantalla de login con botón "Continuar con Google". Muestra `error=AccessDenied` cuando el email no está en la whitelist.
- `src/components/layout/AppLayout.tsx` — si `pathname === '/login'`, renderiza children sin TopBar (para que la pantalla de login sea limpia).
- `src/app/providers.tsx` — envuelve todo en `<SessionProvider>` para que `useSession()` funcione client-side.
- `src/components/layout/TopBar.tsx` — muestra el email del usuario logueado y un `IconButton` con `LogoutIcon` que llama `signOut({ callbackUrl: '/login' })`.

**Env vars requeridas** (ver `.env`):
- `NEXTAUTH_URL` — URL absoluta del sitio (en dev: `http://localhost:3001`; en Vercel se setea automáticamente, pero conviene definirla explícita).
- `NEXTAUTH_SECRET` — secreto para firmar JWTs (generar con `openssl rand -base64 32`).
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — credenciales de OAuth 2.0 creadas en Google Cloud Console. Redirect URI autorizado: `<NEXTAUTH_URL>/api/auth/callback/google`.
- `ALLOWED_EMAILS` — lista coma-separada de emails permitidos (whitelist). Cualquier email fuera de esta lista recibe `AccessDenied` en el callback `signIn`.

Para agregar un nuevo usuario: editar `ALLOWED_EMAILS` (local + Vercel) y hacer redeploy si está en producción. No hay tabla de usuarios — la whitelist es la única autoridad.

## PWA (mobile install)

Instalable como PWA en Android (iOS Safari limitado). Configurado vía:
- `public/manifest.json` — icons (192/512/maskable-512), `start_url: /gastos`, `display: standalone`, `theme_color: #1976d2`.
- `public/sw.js` — service worker minimal. Cachea GET de assets estáticos (network-first, cache fallback). **Skipea `/api/*` y `/_next/data/*`**.
- `src/components/layout/ServiceWorkerRegister.tsx` — registra `/sw.js` solo en producción. Montado desde `src/app/layout.tsx`.
- `src/app/layout.tsx` exporta `metadata` con `manifest`, `icons`, `appleWebApp`, `themeColor`, `viewport`.
- Icons en `public/`: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`.

Al cambiar el manifest o el SW, **bumpear `CACHE_NAME` en `sw.js`** para forzar re-fetch en clients instalados.

## Notificaciones push (vencimientos del día)

Aviso diario con los vencimientos que todavía no están saldados, vía **Web Push** (estándar del browser, sin servicio de terceros más allá del push service del propio navegador).

**Flujo completo:**

1. **Alta (por dispositivo).** `NotificacionesCard` (`src/components/configuracion/NotificacionesCard.tsx`, en `/configuracion`) pide `Notification.requestPermission()`, registra `/sw.js` (idempotente — lo llama explícitamente porque `ServiceWorkerRegister` sólo registra en producción), se suscribe con `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` y postea la suscripción a `/api/push/subscribe`. La clave VAPID pública se convierte de base64url a `Uint8Array` con `urlBase64ToUint8Array` (`src/lib/push-client.ts`).
2. **Persistencia.** Modelo `PushSubscription` (`email`, `endpoint` único, `p256dh`, `auth`, `userAgent`). Un email puede tener varias filas: **el permiso y la suscripción son por browser/dispositivo**, activarlo en el celular no lo activa en la desktop.
3. **Job diario.** `vercel.json` declara el cron `0 11 * * *` (UTC) → **8:00 de Argentina** apuntando a `GET /api/cron/vencimientos`. La ruta está exceptuada del middleware de sesión (`api/cron` en el matcher) y se autentica con `Authorization: Bearer $CRON_SECRET`, header que Vercel manda solo si la env var existe.
4. **Cálculo.** El cron resuelve "hoy" con `fechaEnTimeZone` (`src/lib/fechas.ts`, timezone `America/Argentina/Buenos_Aires` — el cron corre en UTC, nunca usar la fecha local del server), trae los gastos de ese `mes`/`anio`, los mapea con `toGastoResponse` y aplica **`vencimientosDelDia`** (`src/lib/vencimientos.ts`) — la misma función que usa `VencimientosHoyAlert`, así el dialog in-app y la notificación nunca se contradicen.
5. **Texto.** `buildVencimientosPush` (`src/lib/push-payload.ts`) arma `{ title, body, url, tag }`: con un vencimiento nombra el gasto (`"Vence hoy: Luz"` / `"$12.345,67 · Casa"`), con varios resume (`"3 vencimientos hoy"` / `"Total $X · Luz, Internet y 1 más"`, máximo 3 nombres). Devuelve `null` sin vencimientos → el cron no manda nada.
6. **Envío.** `sendPushToAll` (`src/lib/push.ts`, wrapper de `web-push`) manda a todas las suscripciones en paralelo y nunca tira: los errores vuelven en el resultado. Las que el push service reporta muertas (**404/410**) se borran de la DB para que el job no arrastre endpoints inválidos.
7. **Recepción.** `sw.js` escucha `push` (muestra la notificación con `tag` para que la nueva reemplace a la anterior; body de fallback porque `userVisibleOnly` obliga a mostrar algo) y `notificationclick` (enfoca la pestaña abierta y navega a `data.url`, o abre una nueva).

**Env vars requeridas:**

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — par VAPID, generado con `npx web-push generate-vapid-keys`. La pública es `NEXT_PUBLIC_*` porque la usa el browser al suscribirse. **Si se rotan, todas las suscripciones existentes quedan inválidas** y hay que volver a activar en cada device.
- `VAPID_SUBJECT` — `mailto:` o `https:` que identifica al remitente ante el push service.
- `CRON_SECRET` — secreto del cron. Sin él, `/api/cron/vencimientos` responde 500 (no queda abierto).

**Probar a mano:**

```bash
# Payload del día sin mandar nada (acepta today=YYYY-MM-DD para simular otra fecha)
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3002/api/cron/vencimientos?dry=1&today=2026-08-16"
```

Y desde la UI, el botón **"Probar notificación"** de `/configuracion` (`POST /api/push/test`) manda un push real a los devices del usuario logueado.

**Limitaciones a tener en cuenta:**

- **iOS**: sólo funciona si la PWA está instalada en la pantalla de inicio (iOS 16.4+) y se abre desde ahí; el permiso se pierde si se desinstala.
- **Vercel Hobby**: un solo cron por día y se dispara *dentro* de la hora agendada, no al minuto exacto.
- Si el usuario borra datos del sitio o el browser rota la suscripción, el endpoint viejo muere y el job lo limpia solo — pero hay que volver a activar desde `/configuracion`.

## Responsive / mobile UI

Layouts dedicados a `theme.breakpoints.down('sm')` (≤600px) o `down('md')` (≤900px). Usar `useMediaQuery(theme.breakpoints.down(...))` para bifurcar render (no CSS-only).

- **`TopBar`**: hamburger + `Drawer` en `<md`; nav inline en `>=md`.
- **`AppLayout`**: padding `p: { xs: 1.5, sm: 3 }`.
- **`gastos/page.tsx`**: "Nuevo Gasto" es `Fab` bottom-right (circular `<sm`, extended `>=sm`). "Copiar mes" colapsa a `IconButton` en `<sm`.
- **`FiltrosGastos`**: stack vertical en `<md`.
- **`GastosTable`**: renderiza **cards en vez de DataGrid en `<sm`**. Cada card: descripción, chip, fecha, categoría, cuotas, totales 3-col (Total/Pagado/Restante), expand para sub-items, kebab menu (`MoreVertIcon`) con 5 acciones. Sub-items expanden inline con checkboxes incluye_en_total/vencimiento. Desktop mantiene DataGrid.
- **`GastoDialog`, `PagoDialog`, `CopiarMesDialog`, `CopiarGastoDialog`**: `fullScreen={isMobile}` (`<sm`).
- **`GastoItemDialog`**: `fullScreen` en `<md`. Layout 2-col se vuelve stack vertical (resumen + form arriba, lista abajo). En `<md` el form "Agregar sub-item" va dentro de un `Accordion` **cerrado por defecto** para que la lista de items cargados sea visible de entrada; en `>=md` el form se mantiene fijo. Los campos del form están extraídos en una variable `addItemFields` reusada por ambas ramas.
- **`PagoDialog`**, **`CopiarMesDialog`**: forms stackean vertical en `<sm`.
- **`inversiones/page.tsx`**: movimientos `AppDataGrid` reemplazado por lista vertical de cards en `<sm`. Mobile itera `rows` directo (ya en fecha desc + id desc).

Al agregar páginas/tablas, preferir card-based mobile en vez de scroll horizontal del DataGrid.
