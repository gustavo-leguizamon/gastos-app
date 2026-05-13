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

The `/api/resumen` route computes these aggregates server-side for the summary cards.

### Payment system

Payments are tracked via the `Pago` model (separate table), not the legacy `Gasto.totalPagado` field. The `totalPagado` column still exists in the DB for backwards compatibility but is ignored in all display calculations. API routes for payments: `GET|POST /api/gastos/[id]/pagos`, `DELETE /api/gastos/[id]/pagos/[pagoId]`.

### Sub-items (GastoItem)

Each `Gasto` can have informational sub-items (`GastoItem`) to break down what comprises the total — e.g. individual credit card charges under a single card bill. Sub-items do **not** affect payment calculations; they are display-only. API routes: `GET|POST /api/gastos/[id]/items`, `DELETE /api/gastos/[id]/items/[itemId]`.

### State management

`src/store/gastosStore.ts` (Zustand) holds:
- Active filters (`mes`, `anio`, `casa_id`, `tipo_pago`) — initialized to current month/year
- Dialog state (`dialogOpen`, `gastoEditando`) for the create/edit form
- `refreshKey` — incremented via `triggerRefresh()` to force refetches in child components that use it as a `useEffect` dependency

### Key domain concepts

| Field | Meaning |
|---|---|
| `tipo_pago` | `'C'` = credit card, `'D'` = debit |
| `pasaje_mes_siguiente` | Amount carried over to next month |
| `prestamo_a_otro` | Amount loaned to another person |
| `tipo_cambio` | Exchange rate to ARS; always 1 when `moneda.codigo === 'ARS'` |
| `mes` / `anio` | Explicit month/year stored on each expense (not derived from `fechaVencimiento`) |

### API surface

| Route | Purpose |
|---|---|
| `GET/POST /api/gastos` | List (with filters) / create gastos |
| `GET/PUT/DELETE /api/gastos/[id]` | Single gasto CRUD |
| `GET/POST /api/gastos/[id]/pagos` | List / add payments for a gasto |
| `DELETE /api/gastos/[id]/pagos/[pagoId]` | Remove a payment |
| `GET/POST /api/gastos/[id]/items` | List / add sub-items for a gasto |
| `DELETE /api/gastos/[id]/items/[itemId]` | Remove a sub-item |
| `GET /api/resumen` | Aggregated summary cards (total, pagado, restante, pagar hoy) |
| `GET/POST /api/casas` | Houses CRUD |
| `GET/POST /api/monedas` | Currencies CRUD |
| `GET/POST /api/tarjetas` | Credit cards CRUD |

All `/api/gastos` responses include the full `pagos` and `items` arrays via the shared `INCLUDE` constant and `toGastoResponse()` mapper defined in each route file.

### Path alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).
