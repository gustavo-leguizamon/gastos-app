# Gastos: cálculos, resumen, pagos, sub-items

## Computed fields

`total_ars`, `total_pagado`, y `total_restante` son **no almacenados** — se computan en query:
- `total_ars = totalMoneda * tipoCambio`
- `total_pagado = SUM(pagos.monto)` — del relation `Pago`, **no** de `Gasto.totalPagado`
- `total_restante = total_ars - total_pagado`

`/api/resumen` computa estos agregados server-side para las cards. También devuelve:
- `total_gastos_neto = total_gastos - total_prestamos - total_tarjetas - total_pasajes`
- `total_prestamos = SUM(prestamo_a_otro)`
- `total_tarjetas = SUM(total_ars) for gastos with tipoPago === 'C' AND prestamo_a_otro === 0` — gastos crédito con `prestamo_a_otro > 0` se excluyen para no restar dos veces.
- `total_pasajes = SUM(pasaje_mes_siguiente)` — montos pasados al mes siguiente también restan al neto.

Se muestran como breakdown secundario dentro de la card "Total Gastos" (solo si al menos uno es no-cero).

**Unconfirmed gastos en resumen:** gastos con `confirmado = false` se excluyen de todos los totales, **excepto** cuando tienen sub-items — en ese caso, la suma de sus sub-items con `incluyeEnTotal = true` se usa en vez del total del gasto.

## Estimado próximo mes (`total_proximo_mes`)

Card adicional en el resumen que proyecta el gasto del próximo mes basado en histórico.

**Configuración** (`/configuracion` → "Estimación próximo mes", tabla `Settings`, singleton `id = 1`):
- `estim_meses_atras` (default `2`, rango 0–12): meses previos al actual a usar en el promedio.
- `estim_missing_behavior` (default `"zero"`): si una unidad no tiene match en un mes anterior. `"zero"` aporta 0; `"average_found"` promedia solo con los meses que sí tienen match.
- `estim_incluir_cuotas_vigentes` (default `true`): si una unidad está en cuotas y no es la última, suma el monto directamente (saltea el promedio).
- `estim_excluir_ultima_cuota` (default `true`): excluye unidades cuya `cuotaActual >= cuotasTotales`.

`GET /api/settings` upsertea la fila al primer pedido. `PUT /api/settings` actualiza (validación: enteros en rango, enum, coerción booleana). Responses snake_case.

**Algoritmo:**

1. **Unidades** del mes actual y de los `estim_meses_atras` meses previos. Para cada gasto:
   - Si tiene sub-items con `incluyeEnTotal = true`: **agrupados por descripción normalizada (sumando montos)** dentro del gasto. Cada grupo es una unidad (key = `parentDesc + desc`).
   - Si no tiene sub-items elegibles y está confirmado: el gasto es una unidad (key = `desc` solo).
   - Gastos no confirmados sin items se ignoran.
   - Descripciones normalizadas a `trim().toLowerCase()` antes del match.
   - Si en un grupo de sub-items alguno tiene `cuotaActual/cuotasTotales`, se conservan en la unidad agrupada.
2. **Para cada unidad del mes actual:**
   - Si está en cuotas y `estim_excluir_ultima_cuota = true` y es la última: se excluye.
   - Si está en cuotas y `estim_incluir_cuotas_vigentes = true`: se suma directo, sin promediar.
   - En caso contrario: se promedia. Para cada mes previo, se busca match por keys. Si no hay match, según `estim_missing_behavior`. Estimado = promedio del array.
3. La card suma los estimados de todas las unidades.

`/api/resumen` ejecuta `1 + estim_meses_atras` queries en paralelo. Los meses previos no necesitan `pagos`.

## Payment system

Pagos vía modelo `Pago` (tabla separada), no el legacy `Gasto.totalPagado`. La columna `totalPagado` sigue en la DB pero se ignora. Routes: `GET|POST /api/gastos/[id]/pagos`, `PUT|DELETE /api/gastos/[id]/pagos/[pagoId]`. `PUT` acepta `{ fecha, monto }` para editar inline desde `PagoDialog`.

## Sub-items (GastoItem)

Cada `Gasto` puede tener sub-items informativos (`GastoItem`) — ej. cargos individuales bajo un resumen de tarjeta. **No afectan cálculos de pago**; son display-only. Routes: `GET|POST /api/gastos/[id]/items`, `PUT|PATCH|DELETE /api/gastos/[id]/items/[itemId]`.

Cada `GastoItem` tiene dos flags booleanos:
- `incluye_en_total` (`incluyeEnTotal`, default `true`) — si el item suma a la fila de totales de sub-items.
- `incluye_en_vencimiento` (`incluyeEnVencimiento`, default `false`) — si contribuye a la card "Pagar hoy" cuando su `fecha` matchea hoy. Solo cuando el padre `fechaVencimiento` no es hoy (para no duplicar).

Se renderizan como checkboxes inline en la columna de acciones (no columnas separadas). `PATCH` para toggle parcial. Toggle de `incluye_en_vencimiento` llama `triggerResumenRefresh()`.

Sub-items ordenados por `fecha` asc (nulls last) — en `buildFlatRows` y `GastoItemDialog`. La fila total de sub-items aparece **antes** de los items individuales al expandir.

**Sorting de la grilla**: `GastosTable` usa `sortingMode="server"` y `sortModel` controlado. Al click en header el sort aplica solo a filas de gasto (vía `sortGastos()`), y `buildFlatRows` arma flat rows desde los gastos ya ordenados. Sub-items y fila de totales quedan pegados al padre. Comparador soporta `number` y strings (`localeCompare`); nulos al final.

Ambos `Gasto` y `GastoItem` tienen `categoriaId` FK opcional a `Categoria`. (Renombrado de `Lugar` vía migración `20260516000000_rename_lugar_to_categoria` con `ALTER TABLE`/`RENAME COLUMN`.)

`GastoItemDialog` layout 2-col (`maxWidth="md"`, height 90vh): izq (340px) resumen + add form; der lista scrollable. Overflow independiente.

Al agregar/editar/borrar items, se llama `triggerResumenRefresh()` junto con `refreshGasto()` (importante para unconfirmed gastos cuyo total deriva de items).

## State management

`src/store/gastosStore.ts` (Zustand):
- Filtros activos (`mes`, `anio`, `casa_id`, `tipo_pago`) — init al mes/año actual
- Dialog state (`dialogOpen`, `gastoEditando`)
- `refreshKey` / `triggerRefresh()` — reload tabla + cards (create/edit/delete/pay)
- `resumenRefreshKey` / `triggerResumenRefresh()` — reload solo `ResumenCards` (toggles checkbox, edits de pago, sub-item changes)

Filtros client-side en `gastos/page.tsx` (lifted state, props):
- `estadoPago: 'todos' | 'pendiente' | 'saldado'` — default `'pendiente'`. `pendiente` = restante > 0 OR !confirmado. `saldado` = restante ≤ 0 AND confirmado.
- `busqueda: string` — free-text por `descripcion` y `categoria_nombre`. Renderizado en `FiltrosGastos`.

## GastoDialog — cierre

**Cancelar** cierra directo sin pedir confirmación (`onClose` en vez de `handleRequestClose`). El `ConfirmDialog` "¿Cerrar sin guardar?" sigue activo para backdrop/ESC.

## GastoForm — campos condicionales

- **Tipo de cambio**: `tipo_cambio` solo se renderiza cuando la moneda no es ARS. Al cambiar a ARS, set `tipo_cambio = 1`. "Total en ARS" readonly debajo cuando aplica.
- **Cuotas**: `cuota_actual`/`cuotas_totales` ocultos por default. Toggle "Pago en cuotas" (`usaCuotas` local). Al desmarcar, ambos a `null`. Al editar gasto con cuotas pre-existentes, el toggle se inicializa marcado.
- **Total pagado / Pagado completo**: en alta, toggle `pagado_completo` (no se persiste), **marcado por default**. Si marcado, el campo "Total Pagado (ARS)" se oculta. En `GastoDialog.handleSubmit`:
  - Si `pagado_completo = true` → `POST /api/gastos/[id]/pagos` con `{ fecha: gasto.fecha_vencimiento, monto: total_moneda × tipo_cambio }`.
  - Si `pagado_completo = false` y `total_pagado > 0` → registra pago parcial.
  - Si falla, toast pero gasto ya creado.
  - Como el pago va por endpoint normal, **propagación a tarjeta de crédito** dispara automático cuando `tipo_pago = 'C'` con `tarjeta_id`.
  - En edición no se renderiza; pagos por `PagoDialog`.
- **Pasaje / Préstamo**: solo en edición (`isEditing = !!gasto`).
- **Tarjeta obligatoria con crédito**: cuando `tipo_pago === 'C'` el campo `tarjeta_id` es obligatorio (Yup `when('tipo_pago', { is: 'C', ... })`). La UI oculta "Sin especificar" y el label pierde "(opcional)". Sin tarjeta → `FormHelperText` "Seleccioná una tarjeta". `tipo_pago === 'D'` sigue siendo opcional.

## Autocompletado de descripciones

Para evitar variantes de naming entre períodos (rompe match del estimado), los campos "Descripción" de `GastoForm` y `GastoItemDialog` usan `Autocomplete` `freeSolo`:

- `GastoForm`: `GET /api/gastos/descripciones`.
- `GastoItemDialog`: `GET /api/items/descripciones` (parámetro `?parent=...` se acepta pero se ignora).

Ambos endpoints devuelven la **misma unión**: `gastos.descripcion ∪ gastoItem.descripcion`, distintos, ordenados con `localeCompare('es', { sensitivity: 'base' })`. 2 queries paralelas a Prisma con `distinct: ['descripcion']` y dedup con `Set`.

## Vencimientos del día alert

`VencimientosHoyAlert` (`src/components/gastos/VencimientosHoyAlert.tsx`) — montado al inicio de `gastos/page.tsx`. En `useEffect` (una sola vez por mount) hace `GET /api/gastos?mes=<hoy>&anio=<hoy>` y arma la lista de vencimientos del día con **la misma lógica que `pagar_hoy` en `/api/resumen`**:

- Si `g.fecha_vencimiento === today` y `total_restante > 0` y `confirmado`: entra como entrada principal.
- Si **no** vence hoy: se recorren sus `items` y entran como sub-item los que tengan `incluye_en_vencimiento = true && fecha === today`.

Si hay matches abre `Dialog` con la lista (sub-items con `SubdirectoryArrowRightIcon` y caption del padre) y total. Se monta cada navegación a `/gastos`, sin localStorage ni dismissal persistente.

## Copy dialogs

- **`CopiarGastoDialog`** — copia un gasto (+ sub-items). Resetea pagos a cero, `confirmado: false`, ajusta `fechaVencimiento` al mismo día del mes destino.
- **`CopiarMesDialog`** — copia todos los gastos del mes origen al mes destino. Origen default = filtro activo; destino default = mes siguiente. Muestra preview de count y `LinearProgress` durante el loop.

Ambos llaman `triggerRefresh()` al terminar. Propagan al body el flag `es_tarjeta` del origen. Las fechas de cierre **ya no se copian** (viven en `TarjetaCierre` por mes/año independientes).
