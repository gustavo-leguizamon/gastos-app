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

## Responsive / mobile UI

Layouts dedicados a `theme.breakpoints.down('sm')` (≤600px) o `down('md')` (≤900px). Usar `useMediaQuery(theme.breakpoints.down(...))` para bifurcar render (no CSS-only).

- **`TopBar`**: hamburger + `Drawer` en `<md`; nav inline en `>=md`.
- **`AppLayout`**: padding `p: { xs: 1.5, sm: 3 }`.
- **`gastos/page.tsx`**: "Nuevo Gasto" es `Fab` bottom-right (circular `<sm`, extended `>=sm`). "Copiar mes" colapsa a `IconButton` en `<sm`.
- **`FiltrosGastos`**: stack vertical en `<md`.
- **`GastosTable`**: renderiza **cards en vez de DataGrid en `<sm`**. Cada card: descripción, chip, fecha, categoría, cuotas, totales 3-col (Total/Pagado/Restante), expand para sub-items, kebab menu (`MoreVertIcon`) con 5 acciones. Sub-items expanden inline con checkboxes incluye_en_total/vencimiento. Desktop mantiene DataGrid.
- **`GastoDialog`, `PagoDialog`, `CopiarMesDialog`, `CopiarGastoDialog`**: `fullScreen={isMobile}` (`<sm`).
- **`GastoItemDialog`**: `fullScreen` en `<md`. Layout 2-col se vuelve stack vertical.
- **`PagoDialog`**, **`CopiarMesDialog`**: forms stackean vertical en `<sm`.
- **`inversiones/page.tsx`**: movimientos `AppDataGrid` reemplazado por lista vertical de cards en `<sm`. Mobile itera `rows` directo (ya en fecha desc + id desc).

Al agregar páginas/tablas, preferir card-based mobile en vez de scroll horizontal del DataGrid.
