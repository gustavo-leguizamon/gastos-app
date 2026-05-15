# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

**Stack:** Next.js 13 App Router · TypeScript · Material-UI v5 · Prisma + SQLite · Zustand · React Hook Form + Yup

### Data flow

```
Client components
  → fetch() calls to /api/* routes
  → Prisma queries SQLite at data/gastos.db
```

The database file lives at `data/gastos.db` (outside `src/`, outside `prisma/`). Prisma schema references it as `file:../data/gastos.db`.

### Naming convention mismatch (important)

The Prisma schema uses **camelCase** fields (`casaId`, `tipoPago`, `totalMoneda`, etc.), but the API routes and TypeScript interfaces (`src/lib/types.ts`) expose **snake_case** (`casa_id`, `tipo_pago`, `total_moneda`). The `toGastoResponse()` function in each gastos route handles this mapping. All new API routes must follow this same mapping pattern.

### Computed fields

`total_ars`, `total_pagado`, and `total_restante` are **not stored** in the database — they are computed at query time:
- `total_ars = totalMoneda * tipoCambio`
- `total_pagado = SUM(pagos.monto)` — computed from the `Pago` relation, **not** from `Gasto.totalPagado`
- `total_restante = total_ars - total_pagado`

The `/api/resumen` route computes these aggregates server-side for the summary cards. It also returns:
- `total_gastos_neto = total_gastos - total_prestamos - total_tarjetas`
- `total_prestamos = SUM(prestamo_a_otro)`
- `total_tarjetas = SUM(total_ars) for gastos with tipoPago === 'C'` (credit, regardless of tarjetaId)

These are shown as a secondary breakdown inside the "Total Gastos" card (only rendered when at least one of the sub-totals is non-zero).

**Unconfirmed gastos in resumen:** gastos where `confirmado = false` are excluded from all resumen totals, **except** when they have sub-items — in that case, the sum of their sub-items with `incluyeEnTotal = true` is used instead of the gasto's own total. This allows partial/estimated amounts to contribute to the summary via their breakdown items.

### Payment system

Payments are tracked via the `Pago` model (separate table), not the legacy `Gasto.totalPagado` field. The `totalPagado` column still exists in the DB for backwards compatibility but is ignored in all display calculations. API routes for payments: `GET|POST /api/gastos/[id]/pagos`, `PUT|DELETE /api/gastos/[id]/pagos/[pagoId]`. The `PUT` endpoint accepts `{ fecha, monto }` to edit an existing payment inline from `PagoDialog`.

### Sub-items (GastoItem)

Each `Gasto` can have informational sub-items (`GastoItem`) to break down what comprises the total — e.g. individual credit card charges under a single card bill. Sub-items do **not** affect payment calculations; they are display-only. API routes: `GET|POST /api/gastos/[id]/items`, `PUT|PATCH|DELETE /api/gastos/[id]/items/[itemId]`.

Each `GastoItem` has two boolean flags:
- `incluye_en_total` (`incluyeEnTotal` in DB, default `true`) — whether the item's monto counts toward the sub-items totals row in the table.
- `incluye_en_vencimiento` (`incluyeEnVencimiento` in DB, default `false`) — whether the item (using its own `fecha`) contributes to the "Pagar hoy" card when its date matches today. Only applies when the parent gasto's `fechaVencimiento` is not today (to avoid double-counting).

These flags are rendered as checkboxes inside the actions column of sub-item rows (not as separate columns). They can be toggled inline via `PATCH` (partial update) without reloading the table. Toggling `incluye_en_vencimiento` calls `triggerResumenRefresh()` to refresh only the summary cards, not the full gastos table.

Sub-items are sorted by `fecha` ascending (nulls last) — both in `buildFlatRows` (grid) and in `GastoItemDialog` (right-column list). The sub-items total row appears **before** the individual items when expanded in the grid.

Both `Gasto` and `GastoItem` have an optional `lugarId` FK to the `Lugar` model. Lugar can be set in the gasto form and sub-item dialog, and is displayed as a column in the grid.

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
- `busqueda: string` — free-text search filtering by `descripcion` and `lugar_nombre` across all casa groups. Rendered in `FiltrosGastos` alongside the other toggles.

### Copy dialogs

- **`CopiarGastoDialog`** — copies a single gasto (+ its sub-items) to a chosen month/year. Resets all payments to zero, sets `confirmado: false`, adjusts `fechaVencimiento` to the same day in the target month.
- **`CopiarMesDialog`** — copies all gastos of a source month/year to a target month/year. Source defaults to the active filter; target defaults to next month. Shows a count preview before copying and a `LinearProgress` during the sequential copy loop.

Both dialogs call `triggerRefresh()` on completion to reload the full table.

### Key domain concepts

| Field | Meaning |
|---|---|
| `tipo_pago` | `'C'` = credit card, `'D'` = debit |
| `pasaje_mes_siguiente` | Amount carried over to next month |
| `prestamo_a_otro` | Amount loaned to another person |
| `tipo_cambio` | Exchange rate to ARS; always 1 when `moneda.codigo === 'ARS'` |
| `mes` / `anio` | Explicit month/year stored on each expense (not derived from `fechaVencimiento`) |
| `confirmado` | Whether the gasto amount is confirmed. Defaults to `true` on new gastos; always set to `false` when copying. Unconfirmed rows render with an orange background and a warning icon in the expand column. The "Total ARS" cell shows the sub-items sum (in orange) instead of `totalMoneda × tipoCambio` when unconfirmed and items exist. |
| `lugar_id` | Optional FK to `Lugar` — the physical location of the expense. Available on both `Gasto` and `GastoItem`. |

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
| `GET/POST /api/lugares` | Locations CRUD |
| `GET/POST /api/inversiones` | List (sorted by `fecha` asc) / create inversiones |
| `PUT/DELETE /api/inversiones/[id]` | Single inversion edit / delete |

All `/api/gastos` responses include the full `pagos` and `items` arrays via the shared `INCLUDE` constant and `toGastoResponse()` mapper defined in each route file.

### Inversiones

Standalone section (`/inversiones`, navigated from `TopBar`) for tracking investment balance snapshots over time. Independent from the gastos domain — does not share casa/moneda/tarjeta relations.

`Inversion` model fields: `id`, `fecha`, `montoActual`, `montoExtra`, `createdAt`. API responses use snake_case (`monto_actual`, `monto_extra`) per the project's naming convention.

Two computed columns in the grid (not stored, derived client-side after sorting by `fecha` asc, ties broken by `id`):
- `monto_actualizado = monto_actual + monto_extra`
- `cambio = monto_actualizado(current row) - monto_actualizado(previous row)` — `null` for the first row (rendered as `—`). Positive values are green, negative red.

The page (`src/app/inversiones/page.tsx`) shows a form on top (Fecha / Monto actual / Monto extra) that doubles as create and edit (Editar button on a row loads its values; "Cancelar" exits edit mode). The DataGrid below has Editar / Eliminar actions per row.

**Nav menus:** the visible menu is `TopBar.tsx`. `Sidebar.tsx` exists but is currently not rendered by `AppLayout` — keep both NAV arrays in sync when adding routes.

### Dates and timezones

**Never use `new Date().toISOString().split('T')[0]` to get today's date** — `toISOString()` returns UTC, which causes off-by-one errors for timezones behind UTC (e.g. Argentina UTC-3 can show tomorrow's date after 21hs local). Always compute local date using:
```ts
const d = new Date()
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
```
Client components pass `today` as a query param to `/api/resumen` so the server uses the user's local date rather than server UTC.

### Path alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).
