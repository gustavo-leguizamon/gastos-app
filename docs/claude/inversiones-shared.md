# Inversiones y componentes compartidos

## Inversiones

Sección standalone (`/inversiones`, desde `TopBar`) para tracking de balance snapshots. Independiente del dominio gastos — no comparte casa/moneda/tarjeta.

**Two-level model:**
- `Inversion` (parent): `id`, `nombre`, `createdAt`. ABM inline en la página.
- `Movimiento` (child): `id`, `inversionId`, `fecha`, `montoActual`, `montoExtra`, `createdAt`. `onDelete: Cascade`.

Responses snake_case (`monto_actual`, `monto_extra`, `inversion_id`).

**Computed columns** (no almacenados, derivados client-side después de sort por `fecha` asc, ties por `id`):
- `monto_actualizado = monto_actual + monto_extra`
- `cambio = monto_actualizado(actual) - monto_actualizado(previo)` — `null` para la primera fila (`—`). Positivo verde, negativo rojo.
- `dia` — weekday en español parseado de `fecha` como **local** date (split `-` + `new Date(y, m-1, d)` para evitar TZ shift).

**UI** (`src/app/inversiones/page.tsx`):
- Tabs arriba, una por inversion. A la derecha: edit/delete icons sobre el tab activo; **+** abre dialog de create.
- Form debajo de tabs (Fecha / Monto actual / Monto extra) hace create/edit (Editar carga valores; "Cancelar" sale del modo edit).
- DataGrid debajo. **Default sort: `fecha` desc, luego `id` desc.** Como el DataGrid free solo soporta single-column sort, el tiebreaker `id` se implementa pre-reverseando el array (después de computar `cambio` en asc) para que stable sort por `fecha desc` mantenga ties en `id desc`. El cómputo de `cambio` corre siempre en asc internamente (en el memo `rows`), independiente del sort visual.
- Sin inversiones, empty-state card con prompt al **+**.

**Migración:** `prisma/migrate-inversiones.sql` (archival).

**Nav menus:** navegación en `TopBar.tsx` (horizontal AppBar). Para agregar rutas, actualizar array `NAV`.

## AppDataGrid

`src/components/shared/AppDataGrid.tsx` — wrapper genérico de MUI `DataGrid` que todas las grillas deben usar. Provee: `density="compact"`, `sx` base (border, borderRadius, hover), gestión de selección y soporte Delete por teclado. Props clave:
- `onDeleteKeyPress(id)` — llamado al `Delete` sobre fila seleccionada. Cada parent setea `setDeleteId(id)` para abrir su `ConfirmDialog`.
- `selectedRowId` + `onSelectedRowChange` — selección controlada para páginas multi-grid (ej. GastosTable tiene una grilla por casa; comparten un único `selectedGastoId`). Sin estas props, selección por instancia.
- `isRowSelectable` — forwarded a DataGrid; GastosTable pasa `({ row }) => row._type === 'gasto'`.
- `sx` adicional se deep-mergea con base.

El listener `document` keydown en `AppDataGrid` solo dispara si la fila seleccionada pertenece a esa grilla (checkeado via `rows.some(r => id === r.id)`), evitando double-trigger con multiples grillas.

## AppTextField

`src/components/shared/AppTextField.tsx` — wrapper de MUI `TextField` que auto-selecciona el contenido al recibir foco (`e.target.select()` con `setTimeout(0)` para ganarle al cursor). Mantiene API completa. Todos los forms de la app importan desde acá en vez de `@mui/material/TextField`. Para desactivar: `autoSelectOnFocus={false}` o `onFocus` propio. Para crudo, importar `@mui/material/TextField`.

## AppDateField

`src/components/shared/AppDateField.tsx` — wrapper de MUI `TextField` para fechas. Setea `type="date"`, `InputLabelProps.shrink=true`, y abre el calendario nativo al recibir foco vía `HTMLInputElement.showPicker()` (try/catch). El usuario puede tipear manual. Todos los inputs de fecha (gastos: `GastoForm`, `GastoItemDialog`, `PagoDialog`; inversiones: `inversiones/page.tsx`) deben usar este componente.

## AppToggle

`src/components/shared/AppToggle.tsx` — toggle estándar — wrapper de `<FormControlLabel control={<Switch />} label />`. Reemplaza `Checkbox` en toda la app: opciones booleanas con label como Switch. Acepta props de `Switch` (`size`, `color`) más `label` y `labelPlacement`. Usado en: `GastoForm` (es_tarjeta, pagado_completo, usa_cuotas, confirmado), `GastoItemDialog` (incluir_en_total, incluir_en_vencimiento), `configuracion/page.tsx`. Para toggles **sin label** (inline en celdas/cards mobile), usar `<Switch size="small" />` MUI directo.

## AppSelect

`src/components/shared/AppSelect.tsx` — select estándar — wrapper de MUI `Autocomplete` con API simplificada. Permite **tipear para filtrar**. Reemplaza `Select` en toda la app con múltiples opciones. API:
- `label: string`
- `options: { value, label, render? }[]` — `value` es `string | number`, `label` texto buscable. `render` opcional para íconos.
- `value: string | number | null` + `onChange(v)` — controlado.
- `emptyLabel?: string` — agrega opción al inicio (ej. "Todas") cuyo onChange reporta `null`.
- `disableClearable?: boolean`.
- `size`, `fullWidth`, `sx`, `error`, `helperText`, `placeholder` — passthrough.

Usado en: `FiltrosGastos` (Casa), `GastoForm` (Casa, Tarjeta con `render` para `BrandLogo`, Moneda, Categoría), `GastoItemDialog` (Categoría alta + edición), `CopiarGastoDialog` (Mes/Año destino), `CopiarMesDialog` (Mes/Año origen + destino).

**Excepción:** `configuracion/page.tsx` → `estim_missing_behavior` (2 opciones) sigue con `Select` clásico.
