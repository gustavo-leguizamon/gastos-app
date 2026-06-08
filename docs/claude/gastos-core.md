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
- `total_restante_neto = total_restante - total_pasajes` — el restante del mes descontando lo que se pasa al mes siguiente.

Se muestran como breakdown secundario dentro de las cards: "Total Gastos" muestra `total_gastos_neto` + componentes (préstamos/tarjetas/pasajes) si alguno es no-cero; "Restante" muestra `total_restante_neto` + el monto de pasajes si `total_pasajes > 0`.

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
   - Si tiene sub-items con `incluyeEnTotal = true`: **agrupados por `conceptoId` (sumando montos)** dentro del gasto. Cada grupo es una unidad (key = `parentConcepto + concepto`).
   - Si no tiene sub-items elegibles y está confirmado: el gasto es una unidad (key = `concepto` solo).
   - Gastos no confirmados sin items se ignoran.
   - El match entre meses es por **`conceptoId`** (id estable), no por texto — ver [Conceptos](#conceptos).
   - Si en un grupo de sub-items alguno tiene `cuotaActual/cuotasTotales`, se conservan en la unidad agrupada.
2. **Para cada unidad del mes actual:**
   - Si está en cuotas y `estim_excluir_ultima_cuota = true` y es la última: se excluye.
   - Si está en cuotas y `estim_incluir_cuotas_vigentes = true`: se suma directo, sin promediar.
   - En caso contrario: se promedia. Para cada mes previo, se busca match por keys. Si no hay match, según `estim_missing_behavior`. Estimado = promedio del array.
3. La card suma los estimados de todas las unidades.

`/api/resumen` ejecuta `1 + estim_meses_atras` queries en paralelo. Los meses previos no necesitan `pagos`.

## Payment system

Pagos vía modelo `Pago` (tabla separada), no el legacy `Gasto.totalPagado`. La columna `totalPagado` sigue en la DB pero se ignora. Routes: `GET|POST /api/gastos/[id]/pagos`, `PUT|DELETE /api/gastos/[id]/pagos/[pagoId]`. `PUT` acepta `{ fecha, monto }` para editar inline desde `PagoDialog`.

El **monto de pagos admite valores negativos** (validación en `PagoDialog` sólo rechaza NaN y `=== 0`, sin `min`). Sirve para reflejar una devolución posterior a un pago. La propagación a tarjeta de crédito (sub-item en el resumen) conserva el signo, así una devolución genera un sub-item negativo.

## Sub-items (GastoItem)

Cada `Gasto` puede tener sub-items informativos (`GastoItem`) — ej. cargos individuales bajo un resumen de tarjeta. **No afectan cálculos de pago**; son display-only. Routes: `GET|POST /api/gastos/[id]/items`, `PUT|PATCH|DELETE /api/gastos/[id]/items/[itemId]`.

Cada `GastoItem` tiene tres flags booleanos:
- `incluye_en_total` (`incluyeEnTotal`, default `true`) — si el item suma a la fila de totales de sub-items.
- `incluye_en_vencimiento` (`incluyeEnVencimiento`, default `false`) — si contribuye a la card "Pagar hoy" cuando su `fecha` matchea hoy. **Si un gasto tiene sub-items, el vencimiento se calcula SIEMPRE a partir de los sub-items marcados (nunca del total del gasto), aunque el `fechaVencimiento` del gasto sea hoy.** Sólo los gastos sin sub-items usan su propio `fechaVencimiento`/`restante`.
- `verificado` (`verificado`, default `false`) — para revisar sub-items uno a uno y marcar cuáles están correctos. En `GastoItemDialog`, cada fila tiene un toggle (icono `CheckCircleIcon` verde si verificado / `RadioButtonUncheckedIcon` naranja si no), y la fila se pinta con fondo verde tenue (verificado) o naranja tenue (no verificado) para tener a la vista los pendientes de revisar. Se togglea vía `PATCH { verificado }`. El `PUT` (editar item completo) preserva `verificado` enviándolo en el payload — el `EditState` lo incluye.

Los flags `incluye_en_total` / `incluye_en_vencimiento` se renderizan como checkboxes inline en la columna de acciones (no columnas separadas). `PATCH` para toggle parcial. Toggle de `incluye_en_vencimiento` llama `triggerResumenRefresh()`.

Sub-items ordenados primero por `incluye_en_vencimiento` (los incluidos en vencimiento primero) y luego por `fecha` asc (nulls last) — en `buildFlatRows`, `renderSubItems` y `GastoItemDialog`. En `GastoItemDialog` el desempate ante misma fecha (o ambos sin fecha) es por `id` asc. La fila total de sub-items aparece **antes** de los items individuales al expandir; luego van los incluidos en vencimiento y por último el resto.

**Sorting de la grilla**: `GastosTable` usa `sortingMode="server"` y `sortModel` controlado. Al click en header el sort aplica solo a filas de gasto (vía `sortGastos()`), y `buildFlatRows` arma flat rows desde los gastos ya ordenados. Sub-items y fila de totales quedan pegados al padre. Comparador soporta `number` y strings (`localeCompare`); nulos al final.

Ambos `Gasto` y `GastoItem` tienen una relación **muchos-a-muchos** con `Categoria` (`categorias`), no un FK único. Implementada como relaciones implícitas de Prisma con nombres `GastoCategorias` (join table `_GastoCategorias`) y `GastoItemCategorias` (join table `_GastoItemCategorias`). En la API se exponen como `categoria_ids: number[]` (para el body de alta/edición) y `categorias: {id, nombre}[]` (para display). En el form/dialog se usa el componente `AppMultiSelect` (chips). El POST conecta con `{ connect: ids.map(id => ({ id })) }`; el PUT reemplaza con `{ set: ids.map(...) }`. Migración desde el FK único `categoriaId` (anteriormente single, renombrado de `Lugar`): se hizo por etapas con `prisma db push` + SQL de copia a las join tables, preservando las asignaciones existentes.

`GastoItemDialog` layout 2-col (`maxWidth="md"`, height 90vh): izq (340px) resumen + add form; der lista scrollable. Overflow independiente. La columna derecha tiene un buscador (`filtroItems`) arriba de la lista que filtra los sub-items por descripción y categoría (case-insensitive); el resumen de la izquierda sigue calculándose sobre todos los items, no sobre los filtrados.

Al agregar/editar/borrar items, se llama `triggerResumenRefresh()` junto con `refreshGasto()` (importante para unconfirmed gastos cuyo total deriva de items).

El **monto de sub-items admite valores negativos** (sin `min: 0`, validación sólo rechaza NaN). Útil para reversiones: un consumo positivo que debita y luego un negativo que lo cancela, dejando ambos movimientos visibles. La suma de items maneja negativos sin cambios.

## State management

`src/store/gastosStore.ts` (Zustand):
- Filtros activos (`mes`, `anio`, `casa_id`, `tipo_pago`) — init al mes/año actual
- Dialog state (`dialogOpen`, `gastoEditando`)
- `refreshKey` / `triggerRefresh()` — reload tabla + cards (create/edit/delete/pay)
- `resumenRefreshKey` / `triggerResumenRefresh()` — reload solo `ResumenCards` (toggles checkbox, edits de pago, sub-item changes)

Filtros client-side en `gastos/page.tsx` (lifted state, props):
- `estadoPago: 'todos' | 'pendiente' | 'saldado'` — default `'pendiente'`. `pendiente` = restante > 0 OR !confirmado. `saldado` = restante ≤ 0 AND confirmado.
- `busqueda: string` — free-text por `descripcion` y nombres de `categorias`. Renderizado en `FiltrosGastos`.

### Selector de mes (`FiltrosGastos`)

Las flechas ‹ › navegan mes a mes (con wraparound de año). Además, el label "Mes Año" (ej. "Diciembre 2025") es un `ButtonBase` clickeable que abre un `Popover` para saltar directo a cualquier mes/año: navegación de año (‹ año ›) + grilla 3×4 de meses abreviados. El mes/año activo se resalta con `primary.main`. Seleccionar un mes setea `mes`+`anio` (del año mostrado en el picker) y cierra el popover. El estado `anioPicker` se inicializa con `filtros.anio` cada vez que se abre.

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

## Conceptos

El "qué" de un gasto/sub-item (Netflix, Luz, Expensas) es una **entidad** `Concepto`, no texto libre. `Gasto` y `GastoItem` referencian por `conceptoId` (FK obligatoria); la **columna `descripcion` ya no existe** en la DB. La API expone `descripcion` derivada de `concepto.nombre` (más `concepto_id`), así todo el display/filtro del cliente sigue usando `gasto.descripcion` sin cambios.

**Por qué:** el match para analytics (evolución, estimado próximo mes, copiar/merge) se hace por `conceptoId` — id estable — en vez de comparar strings normalizados. Variantes de naming ("Netflix" / "netflix " / "Netflix  HBO") ya no rompen el match. Renombrar un concepto se refleja en todo el histórico automáticamente (la `descripcion` es derivada).

**Resolución (write paths):** los forms siguen mandando `descripcion` como texto (o `concepto_id` si ya se eligió uno). Las routes resuelven con `resolveConcepto(prisma, texto)` (`src/lib/conceptos.ts`): find-or-create case-insensitive, normalizando con `normalizeNombre` (trim + colapso de espacios internos, casing preservado). Aplica en `gastos` POST/PUT, `items` POST/PUT, y la propagación de pagos a tarjeta (el sub-item hereda `source.conceptoId`; el gasto CC `esTarjeta` resuelve el nombre de la tarjeta a concepto).

**Autocompletado:** los campos "Descripción" de `GastoForm` y `GastoItemDialog` usan `Autocomplete` `freeSolo`. `GET /api/gastos/descripciones` y `GET /api/items/descripciones` devuelven ahora los **nombres de `Concepto`** (`concepto.nombre`, ordenados con `localeCompare('es', { sensitivity: 'base' })`) — antes era un `distinct` sobre texto libre.

**Administración** (`/configuracion` → "Conceptos", componente `ConceptosManager`): listar (con conteo de uso), renombrar (`PATCH /api/conceptos/[id]`, rechaza colisión con 409), borrar sólo si sin uso (`DELETE`, 409 si en uso), y **fusionar** duplicados (`POST /api/conceptos/merge` con `{ source_id, target_id }`: reasigna gastos+items y borra el origen).

## Vencimientos del día alert

`VencimientosHoyAlert` (`src/components/gastos/VencimientosHoyAlert.tsx`) — montado al inicio de `gastos/page.tsx`. En `useEffect` (una sola vez por mount) hace `GET /api/gastos?mes=<hoy>&anio=<hoy>` y arma la lista de vencimientos del día con **la misma lógica que `pagar_hoy` en `/api/resumen`**:

- Si el gasto **tiene sub-items**: se recorren sus `items` y entran como sub-item los que tengan `incluye_en_vencimiento = true && fecha === today` (sin importar el `fecha_vencimiento` del gasto padre).
- Si el gasto **no tiene sub-items** y `g.fecha_vencimiento === today` y `total_restante > 0` y `confirmado`: entra como entrada principal.

Si hay matches abre `Dialog` con la lista (sub-items con `SubdirectoryArrowRightIcon` y caption del padre) y total. Se monta cada navegación a `/gastos`, sin localStorage ni dismissal persistente.

## Copy dialogs

Ambos dialogs delegan la copia al endpoint server-side **`POST /api/gastos/copiar`** (`{ source_id, mes, anio }`), que centraliza la lógica de merge, dedup y manejo de cuotas. Ya **no** arman el body del gasto/items en el cliente.

- **`CopiarGastoDialog`** — copia un gasto. Llama al endpoint una vez. El toast indica si fue creado o mergeado (y cuántos sub-items se agregaron).
- **`CopiarMesDialog`** — copia los gastos del mes origen al mes destino. Origen default = filtro activo; destino default = mes siguiente. Muestra una lista de checkboxes con todos los gastos del mes origen (descripción, fecha, # sub-items) — **todos seleccionados por defecto**, con un "Seleccionar todos" (checkbox con estado indeterminate). El usuario puede destildar los que no quiera copiar. Hace un loop llamando al endpoint sólo por los gastos seleccionados, con `LinearProgress`. El botón y el resumen reflejan la cantidad seleccionada (`selectedIds`).

Ambos llaman `triggerRefresh()` al terminar.

### Lógica de `POST /api/gastos/copiar`

1. Carga el gasto origen (con items). Calcula `fechaVencimiento` destino = mismo día, nuevo mes/año.
2. **Sub-items candidatos:** si el gasto es `esTarjeta`, sólo los que tienen **cuotas pendientes** (`cuotaActual != null && cuotasTotales != null && cuotaActual < cuotasTotales`). Para gastos normales, todos los sub-items.
3. **Busca si ya existe** un gasto en el destino: `casaId` + `mes` + `anio` + `conceptoId`.
4. **Si existe (merge):** no crea gasto nuevo. Agrega sólo los sub-items candidatos cuyo `conceptoId` **no exista ya** entre los items del gasto destino. Devuelve `{ merged: true, gasto_id, added_items }`.
5. **Si no existe:** crea el gasto (reset de `totalPagado/pasaje/prestamo` a 0, `confirmado: false`, copia `es_tarjeta`, `tarjeta_id`, y conecta sus `categorias`, etc.) y todos los sub-items candidatos (cada uno conecta sus propias `categorias`). Devuelve `{ created: true, gasto_id, added_items }`.
6. **Incremento de cuota:** tanto el **gasto principal** (al crearlo nuevo) como cada **sub-item** copiado, si están en cuotas no finalizadas (`cuotaActual < cuotasTotales`), se copian con `cuotaActual + 1` (`cuotasTotales` sin cambios). Los demás se copian tal cual. Aplica sea o no `esTarjeta`. El gasto sólo incrementa en la rama de creación (en merge no se toca el gasto destino existente).

Las fechas de cierre no se copian (viven en `TarjetaCierre` por mes/año independientes).

## Evolución del gasto (gráfico mensual)

`EvolucionGastoDialog` (`src/components/gastos/EvolucionGastoDialog.tsx`) muestra la evolución del **Total ARS** de un gasto a través de los meses, como un `LineChart` de `@mui/x-charts` (curva `monotoneX`, tooltip al pasar el mouse que muestra el valor del mes).

- Se abre desde `GastosTable`: icono `ShowChartIcon` ("Evolución mensual") en la columna de acciones (desktop) y opción en el menú de tres puntos (mobile).
- Ventana por defecto **6 meses** terminando en el mes/año del filtro activo (incluye el mes actual). Se cambia en pantalla con un `AppSelect` (presets 3/6/9/12/18/24), que vuelve a pedir los datos y recalcula.
- Identifica el gasto entre meses por **`concepto_id` + `casa_id`** del gasto desde el que se abrió (misma lógica de match que copiar/merge).
- Pide los datos a `GET /api/gastos/evolucion?concepto_id=...&mes=...&anio=...` (antes el param era `descripcion`). Bajo el gráfico muestra promedio / máximo / mínimo de los meses con datos (>0).
- `@mui/x-charts` v7 se agregó como dependencia para este gráfico.
