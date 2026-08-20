# Sueldos

Sección para registrar los cobros de sueldo del mes. **Visible para todos los usuarios de la app**, sin restricción propia.

## Acceso: sin gate propio (decisión)

La sección **tuvo** un gate por email, primero hardcodeado en dos archivos y después en la env var `NEXT_PUBLIC_SUELDOS_EMAILS`. Se sacó por completo: el ítem aparece en `TopBar` como uno más, la página no redirige y las routes no chequean nada más allá de la sesión.

El acceso queda determinado por **`ALLOWED_EMAILS`**, la whitelist que ya protege *toda* la app vía `middleware.ts` — nadie sin sesión llega a `/api/sueldos`. En una app donde todos los usuarios habilitados comparten gastos, ingresos y presupuestos, un segundo nivel de permisos sólo para sueldos agregaba configuración (una env var más, que además viajaba al bundle por ser `NEXT_PUBLIC_`) sin agregar aislamiento real: los datos ya estaban en la misma base y bajo la misma whitelist.

**Consecuencia a tener presente:** cualquier email de `ALLOWED_EMAILS` ve y edita los sueldos. Si en algún momento hace falta volver a restringir, el lugar es un guard server-side en las routes (`/api/sueldos` y `/api/sueldos/[id]`) — no ocultar el ítem del menú, que nunca fue control de acceso.

## Modelo (`prisma/schema.prisma`)

```prisma
model Sueldo {
  id             Int      @id @default(autoincrement())
  fecha          String
  mes            Int      // período al que se imputa (explícito, como Gasto e Ingreso)
  anio           Int
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

Ninguna route tiene guard propio: el acceso lo determina la sesión, que ya exige `middleware.ts` para toda la app.

## Campos calculados (en cliente, `src/app/sueldos/page.tsx`)

- **Neto** = `sueldo_ars + sueldo_usd * cotizacion_mep`
- **Bruto** = `Neto / 0.83` (representa cuánto sería el sueldo bruto si lo neto pagado equivale al 83% del bruto teórico).
- Color del Bruto: `success.main` si `bruto >= sueldo_teorico` (y `sueldo_teorico > 0`), de lo contrario `error.main`.

`cotizacion_bna` se almacena por referencia pero no se usa en los cálculos.

## Período (`mes`/`anio`)

Era el único modelo con período que guardaba **sólo `fecha`**, así que cualquier cruce por período tenía que derivar el mes de un string — justo lo que `Gasto` e `Ingreso` evitan a propósito. Ahora tiene `mes`/`anio` explícitos (migración `20260820120000_sueldo_periodo`, backfilleados desde `fecha`), y permite imputar a agosto un sueldo cobrado el 31 de julio.

`periodoDe(body)` (`src/lib/sueldos-compute.ts`) usa el período del body si viene y si no lo deriva de `fecha`. Sin ninguno de los dos marca **1/2000**: un período obviamente incorrecto que salta a la vista, en vez de imputar en silencio al mes actual. Testeado en `sueldos-compute.test.ts`.

El `GET` ordena por `anio desc, mes desc, fecha desc, id desc`.

## UI

- Form arriba (Fecha + 5 inputs numéricos) — patrón similar a Inversiones.
- Desktop: `AppDataGrid` con columnas Fecha, Teórico, ARS, USD, BNA, MEP, Neto, Bruto, acciones (editar/eliminar).
- Mobile: tarjetas con grid 2 columnas; Bruto coloreado según comparación con teórico.
- Item del menú con icono `PaidIcon` insertado entre Inversiones y Configuración.
