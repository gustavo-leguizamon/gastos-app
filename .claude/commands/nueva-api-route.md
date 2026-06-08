---
description: Scaffold de una nueva API route siguiendo la convención del proyecto (camelCase Prisma → snake_case response)
argument-hint: <nombre-recurso> (ej. proveedores)
---

Vas a crear una nueva API route para el recurso: **$ARGUMENTS**

Seguí EXACTAMENTE estas reglas del proyecto (ver `CLAUDE.md`):

## Convención obligatoria de naming
- El schema Prisma usa **camelCase** (`casaId`, `tipoPago`, `totalMoneda`).
- Las API routes y `src/lib/types.ts` exponen **snake_case** (`casa_id`, `tipo_pago`, `total_moneda`).
- Cada route define una función `toXResponse(x: any)` que hace el mapping camelCase → snake_case, igual que `toGastoResponse()` en `src/app/api/gastos/route.ts`. **No saltees este paso.**

## Estructura a crear
1. `src/app/api/$ARGUMENTS/route.ts` → `GET` (lista, con `orderBy`) y `POST` (alta, `status: 201`).
2. `src/app/api/$ARGUMENTS/[id]/route.ts` → `GET` (uno), `PATCH` (editar), `DELETE`.

## Plantilla base (adaptá campos al modelo real)
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function toXResponse(x: any) {
  return {
    id: x.id,
    // mapear cada campo camelCase del modelo a snake_case acá
    created_at: x.createdAt?.toISOString(),
    updated_at: x.updatedAt?.toISOString(),
  }
}

export async function GET() {
  const rows = await prisma.X.findMany({ orderBy: { /* campo */: 'asc' } })
  return NextResponse.json(rows.map(toXResponse))
}

export async function POST(req: NextRequest) {
  const body = await req.json() // body viene en snake_case del cliente
  const created = await prisma.X.create({ data: { /* mapear snake → camelCase */ } })
  return NextResponse.json(toXResponse(created), { status: 201 })
}
```

## Importante
- Montos: redondeá con `Math.round(valor * 100) / 100` (patrón usado en todo el proyecto).
- Fechas "hoy": NUNCA uses `new Date().toISOString().split('T')[0]` (off-by-one por UTC). Usá el cálculo local de `CLAUDE.md`.
- Si el modelo no existe en `prisma/schema.prisma`, usá primero `/nuevo-campo` o agregalo y migralo antes.

## Al terminar
Actualizá `docs/claude/api-surface.md` agregando la(s) ruta(s) nueva(s) a la tabla.
