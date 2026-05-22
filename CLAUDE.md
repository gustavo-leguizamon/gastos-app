# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation policy (regla obligatoria)

Cada vez que el usuario pida un cambio en el comportamiento de la app (nuevas funcionalidades, cambios en cómo se calculan totales, nuevos campos, nuevas rutas API, cambios en filtros, dialogs, flujos de pago/sub-items, etc.), **al final de la tarea debes actualizar esta `CLAUDE.md`** para reflejar el nuevo comportamiento en la sección correspondiente (Architecture, API surface, Key domain concepts, etc.). Si el cambio es puramente cosmético (color, label, typo) o solo refactor interno sin cambio de comportamiento observable, no hace falta tocar la doc — pero al menos confirmá explícitamente que la doc sigue vigente.

El hook `Stop` (`.claude/settings.local.json` → `.claude/hooks/check-docs.ps1`) verifica que `CLAUDE.md` haya sido actualizada cuando hay cambios más recientes en `src/` o `prisma/`. Si la doc quedó desactualizada, el turno se reanuda automáticamente con un recordatorio.

## Commands

```bash
# Development
npm run dev        # Start dev server at localhost:3001

# Build & production
npm run build
npm start          # Runs on port 3001

# Database
npx prisma generate          # Regenerate Prisma client after schema changes (requires dev server stopped)
npx prisma migrate dev        # Run migrations in development
npx prisma db push            # Push schema changes without migration history
npx prisma studio             # Open Prisma Studio GUI
npx prisma db seed            # Seed initial data (currencies, default house)
```

**Important:** After any `prisma/schema.prisma` change, the dev server must be stopped before running `npx prisma generate` — the running server holds a lock on the Windows DLL.

There are no tests configured in this project.

## Architecture

**Stack:** Next.js 13 App Router · TypeScript · Material-UI v5 · Prisma + PostgreSQL (Neon) · Zustand · React Hook Form + Yup · NextAuth (Google OAuth)

### Authentication

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

### Data flow

```
Client components
  → fetch() calls to /api/* routes
  → Prisma queries Postgres (Neon) via DATABASE_URL
```

The database is hosted on **Neon** (serverless Postgres, free tier). The connection string lives in `DATABASE_URL` — set in `.env` locally (gitignored) and in Vercel env vars for production. The legacy SQLite file at `data/gastos.db` is no longer used; it's kept in `/data/*.db` (gitignored) only as a historical local snapshot. `package.json` runs `prisma generate` via `postinstall` so Vercel builds get the client without an extra script.

**Migration note:** the initial data migration from SQLite to Postgres was done via `scripts/migrate-sqlite-to-postgres.js` (truncates Postgres tables, copies rows from `data/gastos.db` preserving IDs, resets sequences). Kept in the repo as archival — requires re-installing `sql.js` to run again.

### PWA (mobile install)

The app is installable as a PWA on Android (and iOS Safari with limitations). Configured via:
- `public/manifest.json` — name, icons (192/512/maskable-512 PNG), `start_url: /gastos`, `display: standalone`, `theme_color: #1976d2`.
- `public/sw.js` — minimal service worker. Caches GET requests to static assets (network-first, cache fallback). **Skips `/api/*` and `/_next/data/*`** so data stays fresh and writes always hit the server.
- `src/components/layout/ServiceWorkerRegister.tsx` — client component that registers `/sw.js` only in production (avoids interfering with `npm run dev`). Mounted from `src/app/layout.tsx`.
- `src/app/layout.tsx` exports `metadata` with `manifest`, `icons`, `appleWebApp`, `themeColor`, and `viewport`. (Next 13 keeps `themeColor`/`viewport` inside `metadata`; the standalone `Viewport` export came in Next 14.)
- Icons in `public/`: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (with safe-area padding for Android adaptive icons). Placeholder design — replace with branded artwork when available.

When changing manifest fields or the SW, **bump `CACHE_NAME` in `sw.js`** so installed clients re-fetch. Service workers cache aggressively; old clients can be stuck on stale versions otherwise.

### Responsive / mobile UI

The app has dedicated mobile layouts at `theme.breakpoints.down('sm')` (≤600px) or `down('md')` (≤900px) where appropriate. Use `useMediaQuery(theme.breakpoints.down(...))` from MUI to bifurcate rendering instead of CSS-only hacks — the data shapes shown on mobile vs desktop differ enough that conditional render is cleaner.

- **`TopBar`**: hamburger + `Drawer` on `<md`; inline `Button` nav on `>=md`. Logo/title flex-grows on mobile to push the menu icon to the edge.
- **`AppLayout`**: padding `p: { xs: 1.5, sm: 3 }`.
- **`gastos/page.tsx`**: "Nuevo Gasto" is a `Fab` at bottom-right (`circular` on `<sm`, `extended` on `>=sm`). "Copiar mes" collapses to an `IconButton` on `<sm`. The old `position: fixed; top` button was removed because it overlapped the AppBar.
- **`FiltrosGastos`**: stacks vertically on `<md`. Búsqueda full-width on top, then casa, then the two toggle groups in a single row sharing 50/50.
- **`GastosTable`**: renders **cards instead of DataGrid on `<sm`**. Each card shows description, chip, fecha, categoría, cuotas, 3-column totals (Total/Pagado/Restante), optional extras row, expand for sub-items, and a kebab menu (`MoreVertIcon`) with the 5 actions (Sub-items, Pagos, Copiar, Editar, Eliminar). Sub-items expand inline with their own incluye_en_total/vencimiento checkboxes. Desktop keeps the existing DataGrid.
- **`GastoDialog`, `PagoDialog`, `CopiarMesDialog`, `CopiarGastoDialog`**: `fullScreen={isMobile}` (`<sm`).
- **`GastoItemDialog`**: `fullScreen` on `<md`. The two-column layout (340px left + flex right) becomes vertical stack on `<md` — resumen + form on top, items list below.
- **`PagoDialog`**: the "Registrar pago" form (Fecha + Monto + Button) stacks vertically on `<sm`, same with the inline-edit row.
- **`CopiarMesDialog`**: origen/destino stack vertically on `<sm`; the `ArrowForwardIcon` swaps to `ArrowDownwardIcon`.
- **`inversiones/page.tsx`**: the movimientos `AppDataGrid` is replaced by a vertical list of cards on `<sm`. The mobile cards iterate `rows` directly (which is already in fecha desc + id desc order, matching the default DataGrid sort) — do **not** re-reverse on mobile. The new-movimiento form also stacks vertically on `<sm`.

When adding new pages or tables, prefer the same pattern: build a card-based mobile view rather than letting DataGrid scroll horizontally.

### Naming convention mismatch (important)

The Prisma schema uses **camelCase** fields (`casaId`, `tipoPago`, `totalMoneda`, etc.), but the API routes and TypeScript interfaces (`src/lib/types.ts`) expose **snake_case** (`casa_id`, `tipo_pago`, `total_moneda`). The `toGastoResponse()` function in each gastos route handles this mapping. All new API routes must follow this same mapping pattern.

### Computed fields

`total_ars`, `total_pagado`, and `total_restante` are **not stored** in the database — they are computed at query time:
- `total_ars = totalMoneda * tipoCambio`
- `total_pagado = SUM(pagos.monto)` — computed from the `Pago` relation, **not** from `Gasto.totalPagado`
- `total_restante = total_ars - total_pagado`

The `/api/resumen` route computes these aggregates server-side for the summary cards. It also returns:
- `total_gastos_neto = total_gastos - total_prestamos - total_tarjetas - total_pasajes`
- `total_prestamos = SUM(prestamo_a_otro)`
- `total_tarjetas = SUM(total_ars) for gastos with tipoPago === 'C' AND prestamo_a_otro === 0` — credit gastos that also have a `prestamo_a_otro > 0` are excluded from this bucket to avoid double-subtracting the same amount (the prestamo already covers what gets netted out).
- `total_pasajes = SUM(pasaje_mes_siguiente)` — amounts carried over to next month are also subtracted from neto.

These are shown as a secondary breakdown inside the "Total Gastos" card (only rendered when at least one of the sub-totals is non-zero).

**Unconfirmed gastos in resumen:** gastos where `confirmado = false` are excluded from all resumen totals, **except** when they have sub-items — in that case, the sum of their sub-items with `incluyeEnTotal = true` is used instead of the gasto's own total. This allows partial/estimated amounts to contribute to the summary via their breakdown items.

**Estimado próximo mes (`total_proximo_mes`):** card adicional en el resumen que proyecta el gasto del próximo mes basado en histórico.

**Configuración** (parametrizable desde `/configuracion` → sección "Estimación próximo mes", persistida en la tabla `Settings`, singleton fila `id = 1`):
- `estim_meses_atras` (default `2`, rango 0–12): cantidad de meses previos al actual a usar en el promedio.
- `estim_missing_behavior` (default `"zero"`): qué hacer cuando una unidad no tiene match en un mes anterior. `"zero"` aporta 0 al promedio; `"average_found"` promedia solo con los meses que sí tienen match (denominador variable).
- `estim_incluir_cuotas_vigentes` (default `true`): si una unidad está en cuotas y no es la última, suma su monto directamente (saltea el promedio).
- `estim_excluir_ultima_cuota` (default `true`): excluye del estimado las unidades cuya `cuotaActual >= cuotasTotales` (no se repetirán el próximo mes).

El endpoint `GET /api/settings` upsertea la fila al primer pedido (devuelve defaults). `PUT /api/settings` actualiza los valores (validación: enteros en rango para `estim_meses_atras`, enum para `estim_missing_behavior`, coerción booleana para los switches). Las respuestas usan snake_case.

**Algoritmo:**

1. **Construcción de "unidades"** del mes actual y de los `estim_meses_atras` meses anteriores. Para cada gasto:
   - Si tiene sub-items con `incluyeEnTotal = true`: **se agrupan por descripción normalizada (sumando montos)** dentro del gasto. Cada grupo es una unidad (key de match = `parentDesc + desc`). Esto evita inflar el cálculo cuando hay muchos sub-items con la misma descripción (ej. 8 cargas de "DiDi") y permite matchear con el total del mismo concepto en meses anteriores.
   - Si no tiene sub-items elegibles y el gasto está confirmado: el gasto es una unidad (key = `desc` solo).
   - Gastos no confirmados sin items se ignoran.
   - Las descripciones se normalizan a `trim().toLowerCase()` antes del match.
   - Si en un grupo de sub-items alguno tiene `cuotaActual/cuotasTotales`, esos valores se conservan en la unidad agrupada (se toma la primera info de cuotas vista en el grupo).
2. **Para cada unidad del mes actual:**
   - Si está en cuotas y `estim_excluir_ultima_cuota = true` y es la última cuota: se excluye.
   - Si está en cuotas y `estim_incluir_cuotas_vigentes = true`: se suma el monto directamente, sin promediar.
   - En caso contrario: se promedia. Para cada mes previo, se busca match por keys. Si no hay match, según `estim_missing_behavior`: `"zero"` aporta 0 al array de valores, `"average_found"` omite el mes. El monto del mes actual siempre entra al array. Estimado de la unidad = promedio del array.
3. La card suma los estimados de todas las unidades y se devuelve como `total_proximo_mes`.

El cálculo se hace en `/api/resumen`, que ejecuta `1 + estim_meses_atras` queries en paralelo (mes actual + N anteriores). Las consultas previas no necesitan `pagos` (solo se usan items y datos del gasto).

### Payment system

Payments are tracked via the `Pago` model (separate table), not the legacy `Gasto.totalPagado` field. The `totalPagado` column still exists in the DB for backwards compatibility but is ignored in all display calculations. API routes for payments: `GET|POST /api/gastos/[id]/pagos`, `PUT|DELETE /api/gastos/[id]/pagos/[pagoId]`. The `PUT` endpoint accepts `{ fecha, monto }` to edit an existing payment inline from `PagoDialog`.

### Sub-items (GastoItem)

Each `Gasto` can have informational sub-items (`GastoItem`) to break down what comprises the total — e.g. individual credit card charges under a single card bill. Sub-items do **not** affect payment calculations; they are display-only. API routes: `GET|POST /api/gastos/[id]/items`, `PUT|PATCH|DELETE /api/gastos/[id]/items/[itemId]`.

Each `GastoItem` has two boolean flags:
- `incluye_en_total` (`incluyeEnTotal` in DB, default `true`) — whether the item's monto counts toward the sub-items totals row in the table.
- `incluye_en_vencimiento` (`incluyeEnVencimiento` in DB, default `false`) — whether the item (using its own `fecha`) contributes to the "Pagar hoy" card when its date matches today. Only applies when the parent gasto's `fechaVencimiento` is not today (to avoid double-counting).

These flags are rendered as checkboxes inside the actions column of sub-item rows (not as separate columns). They can be toggled inline via `PATCH` (partial update) without reloading the table. Toggling `incluye_en_vencimiento` calls `triggerResumenRefresh()` to refresh only the summary cards, not the full gastos table.

Sub-items are sorted by `fecha` ascending (nulls last) — both in `buildFlatRows` (grid) and in `GastoItemDialog` (right-column list). The sub-items total row appears **before** the individual items when expanded in the grid.

**Sorting de la grilla**: `GastosTable` usa `sortingMode="server"` y un `sortModel` controlado por estado local. Cuando el usuario clickea un header, el sort se aplica solo a las filas de gasto (vía `sortGastos()`), y luego `buildFlatRows` construye las filas planas a partir de los gastos ya ordenados. Esto mantiene a los sub-items y a la fila de totales pegados a su gasto padre, sin importar qué columna esté ordenada. El comparador soporta `number` (resta) y strings (`localeCompare`); nulos siempre al final.

Both `Gasto` and `GastoItem` have an optional `categoriaId` FK to the `Categoria` model. Categoría can be set in the gasto form and sub-item dialog, and is displayed as a column in the grid. (Previously called `Lugar` — renombrado a `Categoria` con la migración `20260516000000_rename_lugar_to_categoria` que hace `ALTER TABLE`/`RENAME COLUMN` preservando los datos.)

`GastoItemDialog` uses a two-column layout (`maxWidth="md"`, height 90vh): left column (340px) shows the resumen (Total gasto / Suma sub-items / Sin asignar) and the add form; right column shows the scrollable items list. Both columns handle overflow independently.

When sub-items are added/edited/deleted, `triggerResumenRefresh()` is called alongside `refreshGasto()` so summary cards reflect the change immediately (important for unconfirmed gastos whose totals are derived from items).

### State management

`src/store/gastosStore.ts` (Zustand) holds:
- Active filters (`mes`, `anio`, `casa_id`, `tipo_pago`) — initialized to current month/year
- Dialog state (`dialogOpen`, `gastoEditando`) for the create/edit form
- `refreshKey` / `triggerRefresh()` — reloads both the gastos table and the summary cards (used on create/edit/delete/pay)
- `resumenRefreshKey` / `triggerResumenRefresh()` — reloads only `ResumenCards` without touching the gastos table (used for lightweight updates like checkbox toggles, payment edits, and sub-item changes)

Client-side filters in `gastos/page.tsx` (lifted state, passed as props):
- `estadoPago: 'todos' | 'pendiente' | 'saldado'` — defaults to `'pendiente'` on load. `pendiente` = restante > 0 OR !confirmado. `saldado` = restante ≤ 0 AND confirmado.
- `busqueda: string` — free-text search filtering by `descripcion` and `categoria_nombre` across all casa groups. Rendered in `FiltrosGastos` alongside the other toggles.

### GastoDialog — cierre

El botón **Cancelar** cierra el dialog directamente sin pedir confirmación (llama `onClose` en vez de `handleRequestClose`). La confirmación de "¿Cerrar sin guardar?" (`ConfirmDialog`) sigue activa para cierres accidentales por click en backdrop o tecla ESC, para evitar pérdida de datos por gestos involuntarios.

### GastoForm — campos condicionales

- **Tipo de cambio**: el campo `tipo_cambio` solo se renderiza cuando la moneda seleccionada no es ARS. Cuando se cambia la moneda a ARS, el form setea `tipo_cambio = 1` automáticamente. El cálculo de "Total en ARS" sigue mostrándose como readonly debajo cuando aplica.
- **Cuotas**: los campos `cuota_actual` / `cuotas_totales` están ocultos por defecto. Un `Checkbox` "Pago en cuotas" controla su visibilidad (`usaCuotas` state local del form). Al desmarcarlo, ambos valores se setean a `null` vía `setValue()`. Al editar un gasto que ya tenía cuotas (`cuota_actual` o `cuotas_totales` no null) el toggle se inicializa marcado.
- **Total pagado / Pagado completo**: en alta hay un checkbox `pagado_completo` (no se persiste, es solo del form), **marcado por defecto**. Si está marcado, el campo "Total Pagado (ARS)" se oculta. En `GastoDialog.handleSubmit`, al crear:
  - Si `pagado_completo = true` → se registra un `POST /api/gastos/[id]/pagos` con `{ fecha: gasto.fecha_vencimiento, monto: total_moneda × tipo_cambio }` (el total en ARS del gasto).
  - Si `pagado_completo = false` y `total_pagado > 0` → se registra el pago con ese monto parcial.
  - Si la creación del pago falla, se muestra un toast pero el gasto ya queda creado.
  - Como el pago se crea vía el endpoint normal, la **propagación a tarjeta de crédito** (sub-item en el resumen del próximo mes) se dispara automáticamente cuando el gasto es `tipo_pago = 'C'` con `tarjeta_id`.
  - En edición el checkbox no se renderiza; los pagos se manejan vía `PagoDialog`.
- **Pasaje / Préstamo**: solo se renderizan en modo edición (`isEditing = !!gasto`), no aparecen al crear un gasto nuevo.
- **Tarjeta obligatoria con crédito**: cuando `tipo_pago === 'C'` el campo `tarjeta_id` es obligatorio (validado por Yup vía `when('tipo_pago', { is: 'C', ... })`). En la UI el select de tarjeta oculta la opción "Sin especificar" y el label pierde el "(opcional)". Si se intenta guardar sin seleccionar tarjeta, aparece un `FormHelperText` con el mensaje "Seleccioná una tarjeta". Cuando `tipo_pago === 'D'`, la tarjeta sigue siendo opcional.

### Tarjeta de crédito (resumen de tarjeta) y propagación de pagos

Un gasto puede marcarse como **"resumen de tarjeta"** vía el flag `es_tarjeta` (campo Prisma `esTarjeta`, default `false`). Cuando está activo:

- El select de **Tarjeta** se muestra siempre (independiente del `tipo_pago`).
- La **descripción** se bloquea y se sincroniza automáticamente con el formato `Nombre (Banco)` de la tarjeta seleccionada (si la tarjeta no tiene banco, solo se usa el `nombre`). Implementado en un `useEffect` que llama `setValue('descripcion', ...)` al cambiar `esTarjeta` o `tarjetaId`.
- Aparecen 2 campos de fecha opcionales: `fecha_cierre` (`fechaCierre`) y `fecha_proximo_cierre` (`fechaProximoCierre`). El de vencimiento ya existe en todo gasto.

**Propagación de pagos a la tarjeta** (en `POST /api/gastos/[id]/pagos`, función `propagatePagoToTarjeta`):

1. Solo aplica cuando el **gasto fuente** tiene `tipoPago = 'C'` y `tarjetaId` asignada.
2. Se busca el "resumen de tarjeta" del **mismo mes/año** que el gasto fuente, filtrando por `esTarjeta = true` y mismo `tarjetaId`. Si no existe, no hay `fechaProximoCierre` y se asume el comportamiento "≤" (target = mes siguiente).
3. Se determina el **mes destino** comparando `pago.fecha` con `currentCC.fechaProximoCierre`:
   - `pago.fecha <= fechaProximoCierre` → target = mes del gasto fuente **+1**.
   - `pago.fecha > fechaProximoCierre` → target = mes del gasto fuente **+2**.
   - El helper `shiftMonth(mes, anio, n)` maneja el rollover de mes/año.
4. Se busca el resumen de tarjeta del mes destino (`esTarjeta = true`, mismo `tarjetaId`, target mes/anio). **Si no existe se crea** con defaults: `descripcion = "Nombre (Banco)"` (o solo `nombre` si la tarjeta no tiene banco), `casaId` del fuente, `monedaId = ARS`, `tipoCambio = 1`, `totalMoneda = 0`, `tipoPago = 'D'`, `fechaVencimiento = "{anio}-{mes}-01"`, `confirmado = false`, `esTarjeta = true`.
5. Se crea un `GastoItem` (sub-item) en ese resumen con `descripcion = gasto fuente.descripcion`, `fecha = pago.fecha`, `monto = pago.monto`, `incluyeEnTotal = true`, `pagoId = pago.id` (FK al pago que originó la propagación), y `categoriaId = gasto fuente.categoriaId` (hereda la categoría del gasto que recibió el pago).

La propagación está envuelta en try/catch — si falla, el pago original se mantiene y el error queda en console. Esta lógica también se dispara desde el flujo de "Total Pagado en gasto nuevo" (`GastoDialog` → `POST /api/gastos/[id]/pagos`).

**Cascade al eliminar el pago:** `GastoItem.pagoId` referencia a `Pago` con `onDelete: Cascade`. Cuando un pago se elimina (vía `DELETE /api/gastos/[id]/pagos/[pagoId]` o por cascada al borrar su gasto), Postgres borra automáticamente cualquier sub-item propagado que esté linkeado, manteniendo la consistencia entre el resumen de tarjeta y los pagos efectivamente realizados.

**Cascade inverso (al borrar el sub-item):** el handler `DELETE /api/gastos/[id]/items/[itemId]` verifica si el item tiene `pagoId`. Si lo tiene, en vez de borrar el item directamente, borra el **Pago** referenciado — y el cascade del FK arrastra el item automáticamente. Así, eliminar el sub-item propagado desde el resumen de tarjeta también deshace el pago original en el gasto crédito que lo originó. Si el item no tiene `pagoId` (item común sin propagación), se borra directamente como siempre.

### Autocompletado de descripciones

Para evitar que el mismo gasto/sub-item se cargue con descripciones distintas en diferentes períodos (y que el matching del estimado próximo mes pierda matches), los campos "Descripción" de `GastoForm` y `GastoItemDialog` (alta + edición inline) usan `Autocomplete` de MUI con `freeSolo`:

- `GastoForm`: opciones desde `GET /api/gastos/descripciones` (todas las descripciones distintas de gastos).
- `GastoItemDialog`: opciones desde `GET /api/items/descripciones?parent=<gasto.descripcion>` (descripciones de sub-items cuyo gasto padre tenga esa misma descripción, case-insensitive). Se refetchea cuando cambia `gasto.descripcion`.

`freeSolo` permite que el usuario tipee algo nuevo si no existe en las sugerencias, pero el listado dropdown filtra por substring mientras se escribe, así puede elegir una descripción existente con un click.

### Vencimientos del día alert

`VencimientosHoyAlert` (`src/components/gastos/VencimientosHoyAlert.tsx`) — montado al inicio de `gastos/page.tsx`. En `useEffect` (una sola vez por mount) hace `GET /api/gastos?mes=<hoy>&anio=<hoy>` y arma client-side la lista de vencimientos del día siguiendo la **misma lógica que `pagar_hoy` en `/api/resumen`**:

- Si `g.fecha_vencimiento === today` y `total_restante > 0` y `confirmado`: el gasto entra como entrada principal.
- Si **no** vence hoy: se recorren sus `items` y entran como sub-item los que tengan `incluye_en_vencimiento = true && fecha === today` (con su propia descripción y monto). La condición de "padre no vence hoy" evita duplicar montos cuando ya está cubierto por la fila principal.

Si hay matches abre un `Dialog` con la lista (gastos y sub-items, sub-items marcados con icon `SubdirectoryArrowRightIcon` y caption mostrando el gasto padre) y un total a pagar hoy. El componente se monta cada vez que se navega a `/gastos`, así que la alerta aparece en cada entrada mientras existan vencimientos no saldados (no usa localStorage ni dismissal persistente).

### Copy dialogs

- **`CopiarGastoDialog`** — copies a single gasto (+ its sub-items) to a chosen month/year. Resets all payments to zero, sets `confirmado: false`, adjusts `fechaVencimiento` to the same day in the target month.
- **`CopiarMesDialog`** — copies all gastos of a source month/year to a target month/year. Source defaults to the active filter; target defaults to next month. Shows a count preview before copying and a `LinearProgress` during the sequential copy loop.

Both dialogs call `triggerRefresh()` on completion to reload the full table.

Ambos dialogs propagan al body los campos de tarjeta del resumen (`es_tarjeta`, `fecha_cierre`, `fecha_proximo_cierre`) tal cual los tiene la fila origen — útil para que los gastos que actúan como "resumen de tarjeta" conserven ese estado y sus fechas de cierre al duplicarse. Las fechas se copian tal cual; si querés que reflejen el ciclo del nuevo mes, hay que editarlas a mano en la fila copiada.

### Key domain concepts

| Field | Meaning |
|---|---|
| `tipo_pago` | `'C'` = credit card, `'D'` = debit |
| `pasaje_mes_siguiente` | Amount carried over to next month |
| `prestamo_a_otro` | Amount loaned to another person |
| `tipo_cambio` | Exchange rate to ARS; always 1 when `moneda.codigo === 'ARS'` |
| `mes` / `anio` | Explicit month/year stored on each expense (not derived from `fechaVencimiento`) |
| `confirmado` | Whether the gasto amount is confirmed. Defaults to `true` on new gastos; always set to `false` when copying. Unconfirmed rows render with an orange background and a warning icon in the expand column. The "Total ARS" cell shows the sub-items sum (in orange) instead of `totalMoneda × tipoCambio` when unconfirmed and items exist. |
| `categoria_id` | Optional FK to `Categoria` — categoría del gasto (ej: Auto, Supermercado, Mascotas). Available on both `Gasto` and `GastoItem`. |

### API surface

| Route | Purpose |
|---|---|
| `GET/POST /api/gastos` | List (with filters) / create gastos |
| `GET/PUT/DELETE /api/gastos/[id]` | Single gasto CRUD |
| `GET/POST /api/gastos/[id]/pagos` | List / add payments for a gasto |
| `PUT/DELETE /api/gastos/[id]/pagos/[pagoId]` | Edit / remove a payment |
| `GET/POST /api/gastos/[id]/items` | List / add sub-items for a gasto |
| `PUT/PATCH/DELETE /api/gastos/[id]/items/[itemId]` | Full edit / partial toggle / remove a sub-item |
| `GET /api/resumen` | Aggregated summary cards; accepts `mes`, `anio`, `casa_id`, and `today` (YYYY-MM-DD local date) params |
| `GET/POST /api/casas` | Houses CRUD |
| `GET/POST /api/monedas` | Currencies CRUD |
| `GET/POST /api/tarjetas` | Credit cards CRUD |
| `GET/POST /api/categorias` | Categorías CRUD (`PUT/DELETE /api/categorias/[id]`) |
| `GET/PUT /api/settings` | Singleton de configuración global (parámetros del estimado del próximo mes) |
| `GET /api/gastos/descripciones` | Lista de descripciones distintas de gastos (para autocompletar) |
| `GET /api/items/descripciones` | Lista de descripciones distintas de sub-items. Acepta `?parent=<descripcion>` para filtrar por descripción del gasto padre (case-insensitive) |
| `GET/POST /api/inversiones` | List / create inversiones (parent — only `nombre`) |
| `PUT/DELETE /api/inversiones/[id]` | Rename / delete inversion (cascade deletes its movimientos) |
| `GET/POST /api/inversiones/[id]/movimientos` | List (sorted by `fecha` asc, ties by `id`) / create movimientos for an inversion |
| `PUT/DELETE /api/inversiones/[id]/movimientos/[movId]` | Edit / remove a movimiento |

All `/api/gastos` responses include the full `pagos` and `items` arrays via the shared `INCLUDE` constant and `toGastoResponse()` mapper defined in each route file.

### Inversiones

Standalone section (`/inversiones`, navigated from `TopBar`) for tracking investment balance snapshots over time. Independent from the gastos domain — does not share casa/moneda/tarjeta relations.

**Two-level model:**
- `Inversion` (parent): `id`, `nombre`, `createdAt`. Represents a logical investment/account that groups snapshots. Managed via inline ABM on the page (no separate /configuracion section).
- `Movimiento` (child): `id`, `inversionId`, `fecha`, `montoActual`, `montoExtra`, `createdAt`. Each row is a balance snapshot of its parent inversion. `onDelete: Cascade` — deleting an inversion removes all its movimientos.

API responses use snake_case (`monto_actual`, `monto_extra`, `inversion_id`) per the project's naming convention.

**Computed columns in the movimientos grid** (not stored, derived client-side after sorting by `fecha` asc, ties broken by `id`):
- `monto_actualizado = monto_actual + monto_extra`
- `cambio = monto_actualizado(current row) - monto_actualizado(previous row)` — `null` for the first row (rendered as `—`). Positive values are green, negative red.
- `dia` — Spanish weekday name parsed from `fecha` as a **local** date (split on `-` and `new Date(y, m-1, d)` to avoid timezone shift).

**UI** (`src/app/inversiones/page.tsx`):
- Tabs at the top, one per inversion. To the right: edit/delete icons act on the active tab; **+** button opens the create dialog. Tab selection drives which movimientos are loaded.
- Form below tabs (Fecha / Monto actual / Monto extra) doubles as create/edit (Editar on a row loads its values; "Cancelar" exits edit mode). Submitting creates/updates a movimiento under the active inversion.
- DataGrid below the form. **Default sort: `fecha` descending, then `id` descending as tiebreaker.** Since the free DataGrid only supports single-column sort, the `id` tiebreaker is implemented by pre-reversing the rows array (after computing `cambio` in ascending order) so stable sort by `fecha desc` keeps the same-fecha rows in `id desc` order. The `cambio` computation always runs in ascending order internally (in the `rows` memo), independent of the visual sort, so values stay correct regardless of how the user sorts.
- When no inversiones exist, the page shows an empty-state card prompting the user to create one with the **+** button.

**Migration note:** the original `Inversion` table (single-level, with `fecha`/`montoActual`/`montoExtra` directly) was migrated via `prisma/migrate-inversiones.sql`. That script renames the old table to `Movimiento`, creates a new `Inversion` parent with a default row named "General", and back-fills `inversionId = 1` for all existing snapshots. Kept in the repo as a one-shot historical migration — do not re-run.

**Nav menus:** navigation is handled solely by `TopBar.tsx` (horizontal AppBar). `Sidebar.tsx` has been deleted. When adding new routes, update only the `NAV` array in `TopBar.tsx`.

**`AppDataGrid` (`src/components/shared/AppDataGrid.tsx`):** generic wrapper around MUI `DataGrid` that all grids in the project must use. Provides: `density="compact"`, base `sx` styles (border, borderRadius, hover), row selection management, and keyboard Delete support. Key props:
- `onDeleteKeyPress(id)` — called when `Delete` key is pressed on the selected row; enables selection and the keyboard listener. Each grid's parent calls `setDeleteId(id)` here to open its existing `ConfirmDialog`.
- `selectedRowId` + `onSelectedRowChange` — controlled selection for multi-grid pages (e.g. GastosTable has one grid per casa group; they share a single `selectedGastoId` state so pressing Delete targets the most-recently-clicked row). When omitted, selection is managed internally per grid instance.
- `isRowSelectable` — forwarded to DataGrid; GastosTable passes `({ row }) => row._type === 'gasto'` so sub-item and totals rows are excluded.
- Additional `sx` is deep-merged with the base styles.

The `document` keydown listener in `AppDataGrid` only fires if the selected row belongs to that grid instance (checked via `rows.some(r => id === r.id)`), preventing double-trigger when multiple grids are on the same page.

**`AppTextField` (`src/components/shared/AppTextField.tsx`):** wrapper genérico de MUI `TextField` que auto-selecciona el contenido del input al recibir foco (`e.target.select()` con `setTimeout(0)` para ganarle al cursor que pone el navegador). Mantiene la API completa de `TextField`. Todos los formularios de la app importan `TextField` desde este path en vez de `@mui/material/TextField`. Si en un caso puntual no se quiere ese comportamiento, pasar `autoSelectOnFocus={false}` o un `onFocus` propio. Si necesitás el TextField "crudo" sin auto-selección (caso muy raro), importá `@mui/material/TextField` directamente.

**`AppDateField` (`src/components/shared/AppDateField.tsx`):** wrapper genérico de MUI `TextField` para inputs de fecha. Setea `type="date"` e `InputLabelProps.shrink=true` por defecto, y abre el calendario nativo al recibir foco vía `HTMLInputElement.showPicker()` (envuelto en try/catch porque no está soportado en todos los browsers). El usuario igualmente puede tipear la fecha manualmente. Todos los inputs de fecha de la app (gastos: `GastoForm`, `GastoItemDialog`, `PagoDialog`; inversiones: `inversiones/page.tsx`) deben usar este componente en vez de `<TextField type="date" ... />`.

**`AppToggle` (`src/components/shared/AppToggle.tsx`):** toggle estándar de la app — wrapper de `<FormControlLabel control={<Switch />} label />`. Reemplaza a `Checkbox` en toda la app: todas las opciones booleanas con label se renderizan como Switch (visualmente: deslizador en vez de cuadradito). Acepta todas las props de `Switch` (incluido `size`, `color`) más `label` y `labelPlacement`. Usado en: `GastoForm` (es_tarjeta, pagado_completo, usa_cuotas, confirmado), `GastoItemDialog` (incluir_en_total, incluir_en_vencimiento — alta y edición), `configuracion/page.tsx` (settings de estimación). Para toggles **sin label** (ej. inline en celdas de `GastosTable` o cards mobile), usar `<Switch size="small" />` de MUI directamente — el wrapper solo aplica cuando hay label.

### Dates and timezones

**Never use `new Date().toISOString().split('T')[0]` to get today's date** — `toISOString()` returns UTC, which causes off-by-one errors for timezones behind UTC (e.g. Argentina UTC-3 can show tomorrow's date after 21hs local). Always compute local date using:
```ts
const d = new Date()
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
```
Client components pass `today` as a query param to `/api/resumen` so the server uses the user's local date rather than server UTC.

### Path alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).






