---
description: Checklist para agregar un campo a un modelo Prisma en el orden correcto (schema → push → generate → types → mapping → doc)
argument-hint: <modelo>.<campo> (ej. Gasto.proveedor)
---

Vas a agregar el campo: **$ARGUMENTS**

Seguí este orden EXACTO. El paso 2 es crítico en Windows: el dev server bloquea la DLL de Prisma.

## 1. Schema (camelCase)
Editá `prisma/schema.prisma` y agregá el campo al modelo en **camelCase** (ej. `fechaProximoCierre`). Definí tipo, opcionalidad (`?`) y default si aplica.

## 2. Migrar (con dev server PARADO)
- Confirmá que el dev server NO está corriendo (`netstat -ano | findstr :3002`). Si está, hay que pararlo.
- `npx prisma db push` (o `npx prisma migrate dev` si querés historial de migración).
- `npx prisma generate` para regenerar el client.

## 3. Tipos (snake_case)
Agregá el campo en **snake_case** en la interface correspondiente de `src/lib/types.ts` (ej. `fecha_proximo_cierre`).

## 4. Mapping en la(s) route(s)
Agregá el campo en la función `toXResponse()` de cada route afectada (camelCase → snake_case). Para gastos es `toGastoResponse()` en `src/app/api/gastos/route.ts`, `[id]/route.ts`, etc. Si entra por POST/PATCH, mapealo también en el `data: {}` (snake → camelCase).

## 5. UI (si aplica)
Agregá el campo al dialog/form correspondiente (GastoDialog, GastoForm, etc.) con su validación Yup si corresponde.

## 6. Verificar
Corré `/check` (`npx tsc --noEmit`) para confirmar que los tipos cierran.

## 7. Documentación (obligatorio)
Actualizá el archivo de `docs/claude/` que corresponda al área (ver índice en `CLAUDE.md`). Si el campo afecta cálculos de totales o dominio, actualizá también la tabla "Key domain concepts" de `CLAUDE.md`.
