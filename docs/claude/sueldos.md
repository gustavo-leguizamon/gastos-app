# Sueldos

Sección para registrar los cobros de sueldo del mes. **Acceso restringido** al email `gustavoleguizamn@gmail.com` — el item del menú solo se renderiza en `TopBar` para ese email, y las API routes verifican la sesión vía `isSueldosAllowed()` (en `src/lib/sueldos-auth.ts`) devolviendo 403 si no coincide. La página `/sueldos` además hace `router.replace('/gastos')` si el usuario autenticado no es el permitido.

## Modelo (`prisma/schema.prisma`)

```prisma
model Sueldo {
  id             Int      @id @default(autoincrement())
  fecha          String
  sueldoTeorico  Float    @default(0)
  sueldoArs      Float    @default(0)
  sueldoUsd      Float    @default(0)
  cotizacionBna  Float    @default(0)
  cotizacionMep  Float    @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

Naming convention mismatch habitual: schema camelCase, API/types snake_case (`sueldo_teorico`, `sueldo_ars`, `sueldo_usd`, `cotizacion_bna`, `cotizacion_mep`).

## API

| Route | Purpose |
|---|---|
| `GET/POST /api/sueldos` | Lista (orden por `fecha desc, id desc`) / crea sueldo |
| `PUT/DELETE /api/sueldos/[id]` | Edita / elimina sueldo |

Todas las routes verifican `isSueldosAllowed()` antes de operar.

## Campos calculados (en cliente, `src/app/sueldos/page.tsx`)

- **Neto** = `sueldo_ars + sueldo_usd * cotizacion_mep`
- **Bruto** = `Neto / 0.83` (representa cuánto sería el sueldo bruto si lo neto pagado equivale al 83% del bruto teórico).
- Color del Bruto: `success.main` si `bruto >= sueldo_teorico` (y `sueldo_teorico > 0`), de lo contrario `error.main`.

`cotizacion_bna` se almacena por referencia pero no se usa en los cálculos.

## UI

- Form arriba (Fecha + 5 inputs numéricos) — patrón similar a Inversiones.
- Desktop: `AppDataGrid` con columnas Fecha, Teórico, ARS, USD, BNA, MEP, Neto, Bruto, acciones (editar/eliminar).
- Mobile: tarjetas con grid 2 columnas; Bruto coloreado según comparación con teórico.
- Item del menú con icono `PaidIcon` insertado entre Inversiones y Configuración.
