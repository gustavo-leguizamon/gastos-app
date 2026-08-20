# Sueldos

Sección para registrar los cobros de sueldo del mes. **Acceso restringido** por la env var **`NEXT_PUBLIC_SUELDOS_EMAILS`** (lista coma-separada, mismo formato que `ALLOWED_EMAILS`). El ítem del menú sólo se renderiza en `TopBar` para esos emails, y las API routes verifican la sesión vía `isSueldosAllowed()` (en `src/lib/sueldos-auth.ts`) devolviendo 403 si no coincide.

**Sin la env var no la ve nadie** (lista vacía): ante config faltante, la sección con los datos más sensibles se cierra, no se abre. Antes el email estaba hardcodeado en dos archivos (`sueldos-auth.ts` y `TopBar.tsx`) y cambiar de cuenta obligaba a tocar código y redeployar.

Es `NEXT_PUBLIC_` porque `TopBar` es un client component y decide ahí si muestra el link, así que la lista **viaja en el bundle**. No es un secreto ni el control de acceso: eso siguen siendo los 403 de las routes (que validan contra la sesión del server) y el `router.replace` de la página. La página `/sueldos` además hace `router.replace('/gastos')` si el usuario autenticado no es el permitido.

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

Todas las routes verifican `isSueldosAllowed()` antes de operar.

## Campos calculados (en cliente, `src/app/sueldos/page.tsx`)

- **Neto** = `sueldo_ars + sueldo_usd * cotizacion_mep`
- **Bruto** = `Neto / 0.83` (representa cuánto sería el sueldo bruto si lo neto pagado equivale al 83% del bruto teórico).
- Color del Bruto: `success.main` si `bruto >= sueldo_teorico` (y `sueldo_teorico > 0`), de lo contrario `error.main`.

`cotizacion_bna` se almacena por referencia pero no se usa en los cálculos.

## Período (`mes`/`anio`)

Era el único modelo con período que guardaba **sólo `fecha`**, así que cualquier cruce por período tenía que derivar el mes de un string — justo lo que `Gasto` e `Ingreso` evitan a propósito. Ahora tiene `mes`/`anio` explícitos (migración `20260820120000_sueldo_periodo`, backfilleados desde `fecha`), y permite imputar a agosto un sueldo cobrado el 31 de julio.

`periodoDe(body)` (en `sueldos-auth.ts`, re-exportado de `sueldos-compute.ts`) usa el período del body si viene y si no lo deriva de `fecha`. Sin ninguno de los dos marca **1/2000**: un período obviamente incorrecto que salta a la vista, en vez de imputar en silencio al mes actual. Testeado en `sueldos-auth.test.ts`.

El `GET` ordena por `anio desc, mes desc, fecha desc, id desc`.

## UI

- Form arriba (Fecha + 5 inputs numéricos) — patrón similar a Inversiones.
- Desktop: `AppDataGrid` con columnas Fecha, Teórico, ARS, USD, BNA, MEP, Neto, Bruto, acciones (editar/eliminar).
- Mobile: tarjetas con grid 2 columnas; Bruto coloreado según comparación con teórico.
- Item del menú con icono `PaidIcon` insertado entre Inversiones y Configuración.
