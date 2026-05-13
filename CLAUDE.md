# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev        # Start dev server at localhost:3000

# Build & production
npm run build
npm start

# Database
npx prisma generate          # Regenerate Prisma client after schema changes
npx prisma migrate dev        # Run migrations in development
npx prisma db push            # Push schema changes without migration history
npx prisma studio             # Open Prisma Studio GUI
npx prisma db seed            # Seed initial data (currencies, default house)
```

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

The Prisma schema uses **camelCase** fields (`casaId`, `tipoPago`, `totalMoneda`, etc.), but the API routes and TypeScript interfaces (`src/lib/types.ts`) expose **snake_case** (`casa_id`, `tipo_pago`, `total_moneda`). The `toGastoResponse()` function in `src/app/api/gastos/route.ts` handles this mapping. All new API routes must follow this same mapping pattern.

### Computed fields

`total_ars` and `total_restante` are **not stored** in the database — they are computed at query time:
- `total_ars = totalMoneda * tipoCambio`
- `total_restante = total_ars - totalPagado`

The `/api/resumen` route computes these aggregates server-side for the summary cards.

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

### Path alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).
