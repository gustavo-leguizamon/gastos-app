# Inversiones y componentes compartidos

## Inversiones

Sección standalone (`/inversiones`, desde `TopBar`) para tracking de balance snapshots. Independiente del dominio gastos — no comparte casa/moneda/tarjeta.

**Two-level model:**
- `Inversion` (parent): `id`, `nombre`, `createdAt`. ABM inline en la página.
- `Movimiento` (child): `id`, `inversionId`, `fecha`, `montoActual`, `movimiento`, `createdAt`. `onDelete: Cascade`.

Responses snake_case (`monto_actual`, `movimiento`, `inversion_id`).

**Computed columns** (no almacenados, derivados client-side después de sort por `fecha` asc, ties por `id`):
- `monto_actualizado = monto_actual + movimiento`
- `cambio = monto_actualizado(actual) - monto_actualizado(previo)` — `null` para la primera fila (`—`). Positivo verde, negativo rojo.
- `dia` — weekday en español parseado de `fecha` como **local** date (split `-` + `new Date(y, m-1, d)` para evitar TZ shift).

**UI** (`src/app/inversiones/page.tsx`):
- Tabs arriba, una por inversion. A la derecha: edit/delete icons sobre el tab activo; **+** abre dialog de create.
- Form debajo de tabs (Fecha / Monto actual / Movimiento) hace create/edit (Editar carga valores; "Cancelar" sale del modo edit). El campo "Movimiento" (antes "Monto extra") representa depósito (positivo) o retiro (negativo) aplicado sobre `monto_actual`.
- **Fallback de Monto actual:** si el usuario deja "Monto actual" vacío pero llena "Movimiento", el form resuelve `monto_actual` al del movimiento más reciente (sort fecha desc, id desc; excluyendo la fila en edición). Caso de uso: registrar un depósito/retiro sin re-chequear el balance. Si no hay movimientos previos o ambos campos están vacíos, error.
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

**Paginación / mostrar todas las filas:** el `DataGrid` de la versión MIT (free) **fuerza `pagination: true`** (via `DATA_GRID_FORCED_PROPS`) con un tope máximo de **100 filas por página** (setear `pageSize > 100` lanza excepción). Por eso, una grilla con `hideFooter` y más de 100 filas mostraba solo la primera página **sin ningún control para navegar** — las filas restantes quedaban invisibles (ej. Gastos de un mes con muchos ítems se cortaban por fecha). `AppDataGrid` resuelve esto: cuando se pasa `hideFooter` y el caller **no** definió su propia paginación (`paginationModel` ni `initialState.pagination.paginationModel`), inyecta `paginationModel={{ page: 0, pageSize: -1 }}` (`-1` = `ALL_RESULTS_PAGE_VALUE`, no dispara el límite de 100) para renderizar **todas** las filas. Las grillas con footer visible (inversiones, sueldos) conservan la paginación navegable normal.

## AppTextField

`src/components/shared/AppTextField.tsx` — wrapper de MUI `TextField` que auto-selecciona el contenido al recibir foco (`e.target.select()` con `setTimeout(0)` para ganarle al cursor). Mantiene API completa. Todos los forms de la app importan desde acá en vez de `@mui/material/TextField`. Para desactivar: `autoSelectOnFocus={false}` o `onFocus` propio. Para crudo, importar `@mui/material/TextField`.

## AppDateField

`src/components/shared/AppDateField.tsx` — wrapper de MUI `TextField` para fechas. Setea `type="date"`, `InputLabelProps.shrink=true`, y abre el calendario nativo al recibir foco vía `HTMLInputElement.showPicker()` (try/catch). El usuario puede tipear manual. Todos los inputs de fecha (gastos: `GastoForm`, `GastoItemDialog`, `PagoDialog`; inversiones: `inversiones/page.tsx`) deben usar este componente.

## AppToggle

`src/components/shared/AppToggle.tsx` — toggle estándar — wrapper de `<FormControlLabel control={<Switch />} label />`. Reemplaza `Checkbox` en toda la app: opciones booleanas con label como Switch. Acepta props de `Switch` (`size`, `color`) más `label` y `labelPlacement`. Usado en: `GastoForm` (es_tarjeta, pagado_completo, usa_cuotas, confirmado), `GastoItemDialog` (incluir_en_total, incluir_en_vencimiento), `configuracion/page.tsx`. Para toggles **sin label** (inline en celdas/cards mobile), usar `<Switch size="small" />` MUI directo.

## AppSelect

`src/components/shared/AppSelect.tsx` — select estándar — wrapper de MUI `Autocomplete` con API simplificada. Permite **tipear para filtrar**. Reemplaza `Select` en toda la app con múltiples opciones. API:
- `label: string`
- `options: { value, label, render?, adornment? }[]` — `value` es `string | number`, `label` texto buscable. `render` opcional para íconos.
- `value: string | number | null` + `onChange(v)` — controlado.
- `emptyLabel?: string` — agrega opción al inicio (ej. "Todas") cuyo onChange reporta `null`.
- `disableClearable?: boolean`.
- `onCreate?: (nombre) => Promise<{value,label} | null>` — si se provee, habilita **crear** una opción tipeando (freeSolo + item "Agregar «X»"); debe persistirla y devolver la nueva opción (o null si falla). Cuando no se pasa, el comportamiento es idéntico al anterior (sin freeSolo ni filtro custom).
- `size`, `fullWidth`, `sx`, `error`, `helperText`, `placeholder` — passthrough.

**`render` vs `adornment`**: `render?: () => ReactNode` dibuja el item del **dropdown**; `adornment?: () => ReactNode` dibuja un ícono junto al valor **ya seleccionado** dentro del input (se inyecta como `startAdornment`, preservando el `params.InputProps.startAdornment` de MUI cuando la opción no lo define). Se pasan juntos cuando el campo cerrado tiene que leerse igual que la opción elegida — ej. el logo de marca en los selects de tarjeta de `GastoForm`.

Usado en: `FiltrosGastos` (Casa), `GastoForm` (Medio de pago / Tarjeta con `render` + `adornment` para `BrandLogo`, Casa, Moneda, **Categoría con `onCreate`**), `GastoItemDialog` (Categoría con `onCreate`), `CopiarGastoDialog`/`CopiarMesDialog` (Mes/Año), `configuracion` (Casa por defecto).

**Excepción:** `configuracion/page.tsx` → `estim_missing_behavior` (2 opciones) sigue con `Select` clásico.

## AppMultiSelect

`src/components/shared/AppMultiSelect.tsx` — multi-select — wrapper de MUI `Autocomplete` con `multiple`. Selección de varias opciones mostradas como chips, con typeahead. API:
- `label: string`
- `options: { value, label, render? }[]` — `value` es `string | number`. `render?: () => ReactNode` opcional para mostrar contenido rico (íconos, logos) en el item del dropdown (igual que `AppSelect`); los chips seleccionados siguen usando `label`.
- `value: (string | number)[]` + `onChange(values)` — controlado.
- `onCreate?: (nombre) => Promise<{value,label} | null>` — igual que en `AppSelect`: habilita crear tipeando ("Agregar «X»"). Sin `onCreate`, comportamiento idéntico al anterior.
- `size`, `fullWidth`, `sx`, `placeholder` — passthrough.

Usado para relaciones M2M / etiquetas: `GastoForm` (Etiquetas con `onCreate`), `GastoItemDialog` (Etiquetas con `onCreate`), `ReportesFiltros` (Categorías, Etiquetas, Tarjetas con `render` para `BrandLogo`, Conceptos).

## CategoriasCell

`src/components/shared/CategoriasCell.tsx` — display read-only de la lista de categorías de un gasto o sub-item. Centraliza el formato usado en la grilla principal y en todos los listados de sub-items. Comportamiento:
- **Orden alfabético** (`localeCompare('es', { sensitivity: 'base' })`).
- Render en **una sola línea**; si no entran en el ancho disponible se truncan con ellipsis (`whiteSpace: nowrap` + `textOverflow: ellipsis`, `width: 100%`).
- **Tooltip** con la lista completa al hacer hover.

Props: `categorias: {id,nombre}[]`, `empty?` (qué renderizar si no hay categorías, default `null`), `prefix?` (ej. `'📍 '`), `typographyProps?` (override de `color`/`sx`, etc.).

Usado en: `GastosTable` (columna `categorias` desktop para filas gasto e item, y cards mobile de gasto/item) y `GastoItemDialog` (listado de sub-items). El ancho efectivo lo da el contenedor (la columna del DataGrid o el `flex:1 minWidth:0` de la card/listado).
