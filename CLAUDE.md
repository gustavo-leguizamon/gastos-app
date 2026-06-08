# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation policy (regla obligatoria)

Cada vez que el usuario pida un cambio en el comportamiento de la app (nuevas funcionalidades, cambios en cómo se calculan totales, nuevos campos, nuevas rutas API, cambios en filtros, dialogs, flujos de pago/sub-items, etc.), **al final de la tarea debes actualizar la documentación**:

- Si el cambio toca una sección con archivo dedicado en `docs/claude/`, actualizá ese archivo.
- Si el cambio es transversal o no encaja, actualizá esta `CLAUDE.md` o creá un archivo nuevo en `docs/claude/` y agregalo al índice de abajo.
- Si el cambio es puramente cosmético (color, label, typo) o solo refactor interno sin cambio de comportamiento observable, no hace falta tocar la doc — pero confirmá explícitamente que la doc sigue vigente.

El hook `Stop` (`.claude/settings.local.json` → `.claude/hooks/check-docs.ps1`) verifica que la documentación haya sido actualizada cuando hay cambios más recientes en `src/` o `prisma/`. Si la doc quedó desactualizada, el turno se reanuda automáticamente con un recordatorio.

## Índice de documentación (`docs/claude/`)

Leé el archivo correspondiente cuando trabajes en esa área — no se cargan automáticamente.

| Archivo | Contenido |
|---|---|
| `docs/claude/auth-pwa.md` | NextAuth + Google OAuth + whitelist, PWA/service worker, responsive/mobile UI |
| `docs/claude/gastos-core.md` | Computed fields, resumen, estimado próximo mes, pagos, sub-items, state management, GastoForm/GastoDialog, autocompletado descripciones, vencimientos hoy, copy dialogs, evolución mensual (gráfico) |
| `docs/claude/tarjetas.md` | Logos de marca, `es_tarjeta`, `TarjetaCierre`, propagación de pagos a tarjeta (incluye cascade y sync bidireccional), tarjetas cerradas dashboard |
| `docs/claude/api-surface.md` | Tabla completa de routes `/api/*` |
| `docs/claude/inversiones-shared.md` | Sección Inversiones + componentes compartidos (`AppDataGrid`, `AppTextField`, `AppDateField`, `AppToggle`, `AppSelect`, `AppMultiSelect`) |
| `docs/claude/sueldos.md` | Sección Sueldos (acceso restringido por email, modelo, cálculo Neto/Bruto, coloreado) |

## Commands

```bash
# Development
npm run dev        # Start dev server at localhost:3002

# Build & production
npm run build
npm start          # Runs on port 3002

# Tests (Vitest)
npm test           # Watch mode
npm run test:run   # Single run (CI / pre-commit)

# Database
npx prisma generate          # Regenerate Prisma client after schema changes (requires dev server stopped)
npx prisma migrate dev        # Run migrations in development
npx prisma db push            # Push schema changes without migration history
npx prisma studio             # Open Prisma Studio GUI
npx prisma db seed            # Seed initial data (currencies, default house)
```

**Important:** After any `prisma/schema.prisma` change, the dev server must be stopped before running `npx prisma generate` — the running server holds a lock on the Windows DLL.

## Testing (regla obligatoria)

El proyecto usa **Vitest** (`vitest@0.34`, pin obligado por Node 16 — versiones 1.x+ requieren Node 18/20+). Config en `vitest.config.ts` (alias `@` → `src` definido a mano, sin `vite-tsconfig-paths` porque rompe con el require ESM bajo Node 16). Los tests viven junto al código en `src/**/*.test.ts`.

Para que las routes (`NextRequest`/`NextResponse`) se puedan importar bajo Node 16, `vitest.setup.ts` polyfillea los globals web (`Request`/`Response`/`fetch`) desde `undici@5`.

Hay dos capas de tests:

**1. Lógica de negocio pura** — la lógica de cálculo se extrae de los route handlers (que importan Prisma/Next) a módulos puros en `src/lib/`:

| Módulo | Qué cubre | Test |
|---|---|---|
| `src/lib/gastos-compute.ts` (`toGastoResponse`) | Mapping camelCase→snake_case, `total_ars`/`total_pagado`/`total_restante`, match de cierre de tarjeta por mes/año, mapeo de pagos e items. Importado por `gastos/route.ts` y `gastos/[id]/route.ts`. | `gastos-compute.test.ts` |
| `src/lib/resumen-compute.ts` (`computeResumen`) | Agregados del resumen (gastos/pagado/restante/tarjetas/préstamos/pasajes/neto), `pagar_hoy`, estimado próximo mes (promedio con meses previos, `missingBehavior`, cuotas vigentes, excluir última cuota). Importado por `resumen/route.ts`. | `resumen-compute.test.ts` |
| `src/lib/fechas.ts` (`shiftMonth`) | Aritmética de meses con wraparound de año. Importado por `gastos/[id]/pagos/route.ts`. | `fechas.test.ts` |

**2. API routes con Prisma mockeado** (`vi.mock('@/lib/db', ...)`) — verifican el armado de filtros y el mapping snake_case↔camelCase de entrada/salida:

| Route | Qué cubre | Test |
|---|---|---|
| `gastos/route.ts` | GET arma `where` desde query params; POST mapea body y aplica defaults. | `gastos/route.test.ts` |
| `gastos/[id]/route.ts` | GET 404/mapeo; PUT mapping + sync de descripción a items propagados; DELETE. | `gastos/[id]/route.test.ts` |
| `gastos/[id]/items/route.ts` | POST mapping y defaults de flags. | `gastos/[id]/items/route.test.ts` |
| `gastos/[id]/pagos/route.ts` | Propagación de pago a tarjeta: shift +1/+2 según próximo cierre, creación del gasto CC target, sub-item. | `gastos/[id]/pagos/route.test.ts` |

**Al agregar o cambiar comportamiento, agregá tests** (regla obligatoria, igual que la doc):
- Lógica de cálculo en un route handler → extraela a una función pura en `src/lib/` (sin imports de Prisma/Next) y testeala.
- Route nueva o cambio de mapping/filtros → test con `vi.mock('@/lib/db')` siguiendo los existentes.
- Criterio: si la lógica puede romperse silenciosamente en un cambio futuro, debe tener test.

**Pre-commit:** el hook `.githooks/pre-commit` corre `npm run test:run` y aborta el commit si algún test falla. Se activa solo tras `npm install` (script `prepare` → `git config core.hooksPath .githooks`). Para activarlo manualmente: `git config core.hooksPath .githooks`. Para saltearlo en un commit puntual (no recomendado): `git commit --no-verify`.

## Stack

Next.js 13 App Router · TypeScript · Material-UI v5 · Prisma + PostgreSQL (Neon) · Zustand · React Hook Form + Yup · NextAuth (Google OAuth).

```
Client components
  → fetch() calls to /api/* routes
  → Prisma queries Postgres (Neon) via DATABASE_URL
```

DB en **Neon** (serverless Postgres). Connection string en `DATABASE_URL` — `.env` local (gitignored) y env vars de Vercel para prod. `package.json` corre `prisma generate` via `postinstall` para builds de Vercel. La migración inicial SQLite→Postgres se hizo vía `scripts/migrate-sqlite-to-postgres.js` (archival).

## Naming convention mismatch (IMPORTANT)

El Prisma schema usa **camelCase** (`casaId`, `tipoPago`, `totalMoneda`, etc.), pero las API routes y TypeScript interfaces (`src/lib/types.ts`) exponen **snake_case** (`casa_id`, `tipo_pago`, `total_moneda`). La función `toGastoResponse()` en cada gastos route hace el mapping. **Toda nueva API route debe seguir el mismo patrón.**

## Key domain concepts

| Field | Meaning |
|---|---|
| `tipo_pago` | `'C'` = credit card, `'D'` = debit |
| `pasaje_mes_siguiente` | Amount carried over to next month |
| `prestamo_a_otro` | Amount loaned to another person |
| `tipo_cambio` | Exchange rate to ARS; always 1 when `moneda.codigo === 'ARS'` |
| `mes` / `anio` | Explicit month/year stored on each expense (not derived from `fechaVencimiento`) |
| `confirmado` | Si el monto está confirmado. Default `true` en alta; siempre `false` al copiar. Filas no confirmadas se renderizan con fondo naranja e icono warning. "Total ARS" muestra suma de sub-items (en naranja) en vez de `totalMoneda × tipoCambio` cuando no confirmado y hay items. |
| `categoria_ids` / `categorias` | Relación **muchos-a-muchos** con `Categoria` (ej: Auto, Supermercado, Mascotas) en `Gasto` y `GastoItem`. API expone `categoria_ids: number[]` (body) y `categorias: {id,nombre}[]` (display). UI usa `AppMultiSelect`. Ver `docs/claude/gastos-core.md`. |

## Dates and timezones (IMPORTANT)

**Never use `new Date().toISOString().split('T')[0]` to get today's date** — `toISOString()` returns UTC, lo que causa off-by-one para timezones detrás de UTC (ej. Argentina UTC-3 puede mostrar mañana después de 21hs local). Siempre computar local date así:

```ts
const d = new Date()
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
```

Los client components pasan `today` como query param a `/api/resumen` para que el server use la fecha local del usuario, no UTC del server.

## Path alias

`@/*` mapea a `src/*` (configurado en `tsconfig.json`).

