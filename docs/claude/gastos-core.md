# Gastos: cálculos, resumen, pagos, sub-items

## Computed fields

`total_ars`, `total_pagado`, y `total_restante` son **no almacenados** — se computan en query:
- `total_ars = totalMoneda * tipoCambio`
- `total_pagado = SUM(pagos.monto)` — del relation `Pago`, **no** de `Gasto.totalPagado`
- `total_restante = total_ars - total_pagado`

**Montos negativos:** **todos** los campos de monto del gasto admiten valores negativos, para reflejar devoluciones/reintegros de tarjeta de crédito y ajustes: `total_moneda`, `total_pagado`, `pasaje_mes_siguiente`, `prestamo_a_otro`, el monto de los pagos (`PagoDialog`, alta y edición) y el de los sub-items (`GastoItem.monto`). Ningún campo de monto lleva `min` en `inputProps` ni `min(0)` en Yup. El negativo se propaga a `total_ars` y a los agregados del resumen restando del total.

Los únicos pisos numéricos que quedan son `tipo_cambio > 0` (`min(0.0001)`) y las cuotas `>= 1`. Los pagos siguen rechazando monto `0` (`PagoDialog` valida `montoNum !== 0`).

El schema Yup del formulario vive en **`src/lib/gasto-form-schema.ts`** (módulo puro, sin imports de MUI/React) y `GastoForm` lo consume vía `yupResolver`. Está testeado en `gasto-form-schema.test.ts`: acepta negativos en los cuatro montos y mantiene los pisos de `tipo_cambio`, cuotas, casa/moneda/descripción y tarjeta requerida cuando `tipo_pago === 'C'`.

En el grid, las columnas **Pasaje** y **Préstamo** (y el bloque de extras de la vista mobile) se muestran cuando el valor es `!== 0` — antes usaban `> 0`, lo que ocultaba los negativos.

`/api/resumen` computa estos agregados server-side para las cards. También devuelve:
- `total_gastos_neto = total_gastos - total_prestamos - total_tarjetas - total_pasajes`
- `total_prestamos = SUM(prestamo_a_otro)`
- `total_tarjetas = SUM(total_ars) for gastos with tipoPago === 'C' AND prestamo_a_otro === 0` — gastos crédito con `prestamo_a_otro > 0` se excluyen para no restar dos veces.
- `total_pasajes = SUM(pasaje_mes_siguiente)` — montos pasados al mes siguiente también restan al neto.
- `total_restante_neto = total_restante - total_pasajes` — el restante del mes descontando lo que se pasa al mes siguiente.

- `total_ingresos` = suma de los `Ingreso` del mes **en ARS** (`montoMoneda * tipoCambio`, como el gasto); `total_debito` = `SUM(total_ars)` de los gastos con `tipoPago === 'D'` (débito/efectivo, incluye los resúmenes de tarjeta y excluye los consumos de crédito, que ya están dentro de esos resúmenes); `total_ahorro` = `total_ingresos - total_debito` y `ahorro_pct`. Ver `docs/claude/ingresos.md`.

Se muestran como breakdown secundario dentro de las cards: "Total Gastos" muestra `total_gastos_neto` + componentes (préstamos/tarjetas/pasajes) si alguno es no-cero; "Restante" muestra `total_restante_neto` + el monto de pasajes si `total_pasajes > 0`.

`ResumenCards` renderiza además las cards **Ingresos** (abre el ABM del mes en `IngresosDialog`) y **Ahorro** (con el % de lo ingresado, en rojo si es negativo y `—` si no hay ingresos cargados).

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

## Vencidos (lo que ya pasó de fecha y sigue impago)

El único aviso de vencimientos era **"vence hoy"**: si no abrías la app ese día, nada volvía a avisarte. Un gasto vencido e impago quedaba invisible salvo por el color naranja de su fecha en la grilla, y sólo dentro del mes filtrado.

**`vencimientosPendientes(gastos, today)`** (`src/lib/vencimientos.ts`) devuelve los de hoy **y** los atrasados, con `estado: 'hoy' | 'vencido'`, `fecha` y `dias_atraso`. Ordena del más viejo al más nuevo. `vencimientosDelDia` pasa a ser un filtro sobre ella, así `pagar_hoy` y el alert del día no cambian de semántica. `sumVencimientos` centraliza el total.

**Asimetría deliberada en los sub-items vencidos:** un sub-item no tiene estado de pago propio (son display-only), así que el único indicio disponible es el **restante del gasto padre**. Para `estado: 'vencido'` se exige que el padre siga con saldo; sin esa guarda, un resumen de tarjeta ya pagado reportaría como vencido cada consumo pasado, para siempre. Los sub-items de **hoy** conservan el comportamiento histórico (entran sin mirar el restante del padre) para no alterar `pagar_hoy` ni el alert.

**`total_vencido`** en `/api/resumen` alimenta la card **"Vencido"**, que **se oculta cuando está en cero** (en un mes al día una card en cero sería ruido, y cuando aparece tiene que llamar la atención). Es **month-scoped**, igual que todas las demás cards del resumen: el resumen sólo carga el mes consultado.

**El alert y el push miran también el mes anterior** (`shiftMonth(-1)`), para que un atraso de fin de mes no desaparezca el día 1 sólo porque cambió el período. El push (`buildVencimientosPush`) pone los vencidos por delante en el título: *"Vencido hace 3 días: Luz"*, *"3 vencimientos atrasados"*, *"2 vencidos y 1 vence hoy"*.

`diasEntre(desde, hasta)` (`src/lib/fechas.ts`) arma las fechas en **UTC a mediodía**: `new Date(str)` correría el día en timezones detrás de UTC, y armarlas como locales haría que un cambio de horario de verano devuelva 0,96 días.

## Notas visibles y búsqueda ampliada

`Gasto.notas` se cargaba en el form y se guardaba, pero **no se veía en ningún lado**: había que abrir a editar el gasto para saber que existían.

- **Desktop:** icono `StickyNote2Outlined` al lado de la descripción, con tooltip que muestra el texto completo (respetando saltos de línea).
- **Mobile:** la nota va **en texto** debajo de los chips (2 líneas máximo). Un tooltip sobre un icono chico no se puede abrir con el dedo.

**`matchBusqueda(gasto, busqueda)`** (`src/lib/gastos-filtro.ts`, puro y testeado) es ahora el predicado de la búsqueda libre. Vive fuera del componente porque decide **qué filas ve el usuario**: si se rompe en silencio, un gasto "desaparece" y no hay forma de notarlo en pantalla.

Matchea: descripción, categoría, etiquetas y **notas** del gasto, más la descripción, categoría y etiquetas de **cada sub-ítem**. Los sub-ítems entran porque en un resumen de tarjeta el detalle vive ahí: buscar "Netflix" tiene que encontrar el resumen que lo contiene. El match por sub-ítem devuelve la **fila del gasto padre**, que es el nivel al que filtra la grilla.

## Mover un gasto a otro mes

`mes`/`anio` salían del filtro activo al cargar el gasto y **no eran editables por ningún lado**: un gasto imputado al mes equivocado sólo se podía arreglar borrándolo y volviendo a cargarlo, perdiendo sus pagos y sus sub-items.

**`PATCH /api/gastos/[id]/periodo`** con `{ mes, anio, mover_fecha?: boolean }`. Es un endpoint acotado a propósito y no un `PUT` completo: mover de mes no debe poder pisar montos, concepto ni clasificación por un body incompleto. Los pagos y sub-items viajan con el gasto sin tocarse.

- **`mover_fecha` es opcional y explícito.** Reimputar a otro mes es una decisión contable y no siempre implica que la `fechaVencimiento` real haya cambiado (un gasto que venció el 31/7 puede imputarse a agosto conservando su fecha).
- **`shiftFechaAPeriodo`** (`src/lib/mover-periodo.ts`) conserva el día y lo **recorta al último del mes destino** (31 de enero → 28/29 de febrero), sin desbordar al mes siguiente.
- Si la fecha guardada está mal formada, el período se mueve igual y la fecha queda como está.

UI: **`MoverGastoDialog`** (`src/components/gastos/MoverGastoDialog.tsx`), que se abre desde **"Mover a otro mes"** en el menú de la fila (`DriveFileMove`). Muestra el preview del cambio de fecha y avisa cuando es un **resumen de tarjeta** (los `TarjetaCierre` viven aparte por mes y no se mueven con él). Al terminar dispara el refresh global, no el de la fila: el gasto sale del mes que se está mirando, así que la grilla y las cards del resumen quedan desactualizadas.

## Exportar a CSV

No había forma de sacar los datos de la app. `src/lib/csv.ts` (serializador genérico) + `src/lib/csv-export.ts` (qué columnas sale de cada cosa) + `src/lib/csv-descargar.ts` (el `Blob`/`<a download>`, separado porque toca `document`/`URL`, que no existen en los tests).

Formato apuntado a que **abra bien en Excel en español**: separador **`;`** (con `,` la configuración es-AR mete la fila entera en una celda), **coma decimal** sin separador de miles, y **BOM UTF-8** (sin él Excel lee el archivo como ANSI y rompe los acentos). Escapado RFC 4180: se entrecomilla ante separador, comillas o saltos de línea, y las comillas internas se duplican. `null` queda como celda vacía, no como la cadena `"null"`; los booleanos salen `Sí`/`No`.

Desde la grilla, el botón **"Exportar"** ofrece **Gastos** y **Sub-ítems** (una fila por sub-ítem con el gasto padre de contexto). Se exporta **`gastosFiltrados`**, no todos los del mes: el archivo tiene que coincidir con lo que el usuario está viendo. La exportación de gastos incluye los computados (`total_ars`, `total_pagado`, `total_restante`) porque no se pueden recalcular desde el CSV — el pagado sale de la tabla `Pago`.

## Presupuestos

Topes mensuales por categoría, en su propia sección `/presupuestos` (comparte el `filtros` del `gastosStore`, así que sigue el mes que se está mirando). Ver [presupuestos.md](presupuestos.md).

## Payment system

Pagos vía modelo `Pago` (tabla separada), no el legacy `Gasto.totalPagado`. La columna `totalPagado` sigue en la DB pero se ignora. Routes: `GET|POST /api/gastos/[id]/pagos`, `PUT|DELETE /api/gastos/[id]/pagos/[pagoId]`. `PUT` acepta `{ fecha, monto }` para editar inline desde `PagoDialog`.

El **monto de pagos admite valores negativos** (validación en `PagoDialog` sólo rechaza NaN y `=== 0`, sin `min`). Sirve para reflejar una devolución posterior a un pago. La propagación a tarjeta de crédito (sub-item en el resumen) conserva el signo, así una devolución genera un sub-item negativo.

## Sub-items (GastoItem)

Cada `Gasto` puede tener sub-items informativos (`GastoItem`) — ej. cargos individuales bajo un resumen de tarjeta. **No afectan cálculos de pago**; son display-only. Routes: `GET|POST /api/gastos/[id]/items`, `PUT|PATCH|DELETE /api/gastos/[id]/items/[itemId]`.

Cada `GastoItem` tiene tres flags booleanos:
- `incluye_en_total` (`incluyeEnTotal`, default `true`) — si el item suma a la fila de totales de sub-items. En `GastoItemDialog`, la card "Suma sub-items" (y por ende "Sin asignar" = `total_ars − suma`) suma **solo** los items con `incluye_en_total`; los que solo están marcados como `incluye_en_vencimiento` no cuentan.
- `incluye_en_vencimiento` (`incluyeEnVencimiento`, default `false`) — si contribuye a la card "Pagar hoy" cuando su `fecha` matchea hoy. **Si un gasto tiene sub-items, el vencimiento se calcula a partir de los sub-items marcados (nunca del total del gasto), aunque el `fechaVencimiento` del gasto sea hoy** — salvo los **resúmenes de tarjeta** (`es_tarjeta`), ver abajo. Los gastos sin sub-items usan su propio `fechaVencimiento`/`restante`.

**Regla compartida — `vencePorGasto(esTarjeta, itemsCount)` (`src/lib/vencimientos.ts`, testeada en `vencimientos.test.ts`)**: un gasto vence **por sí mismo** (`fechaVencimiento` + restante) si no tiene sub-items **o si es un resumen de tarjeta**. Los sub-items de un resumen de tarjeta son los consumos propagados del período (creados siempre con `incluyeEnVencimiento: false`), no vencimientos independientes: el total del resumen vence en la fecha de vencimiento de la tarjeta. Sin esta excepción los resúmenes de tarjeta nunca entraban en "Pagar hoy" ni en el alert. La usan `computeResumen` (`pagar_hoy`) y `VencimientosHoyAlert`, para que card y alert no se desincronicen.
- `verificado` (`verificado`, default `false`) — para revisar sub-items uno a uno y marcar cuáles están correctos. En `GastoItemDialog`, cada fila tiene un toggle (icono `CheckCircleIcon` verde si verificado / `RadioButtonUncheckedIcon` naranja si no), y la fila se pinta con fondo verde tenue (verificado) o naranja tenue (no verificado) para tener a la vista los pendientes de revisar. Se togglea vía `PATCH { verificado }`. El `PUT` (editar item completo) preserva `verificado` enviándolo en el payload — el `EditState` lo incluye.

Los flags `incluye_en_total` / `incluye_en_vencimiento` se renderizan como checkboxes inline en la columna de acciones (no columnas separadas). `PATCH` para toggle parcial. Toggle de `incluye_en_vencimiento` llama `triggerResumenRefresh()`.

### Subtotal de sub-items vs. total cargado

`src/lib/subitems-total.ts` (testeado en `subitems-total.test.ts`) centraliza la comparación:

- `sumItemsTotal(items)` — suma **sólo** los items con `incluye_en_total`.
- `checkSubitemsTotal(items, total_ars)` → `{ hasItems, itemsTotal, gastoTotal, diferencia, matches }`. `diferencia = itemsTotal − gastoTotal` (positivo = los sub-items suman de más) y `matches` es `true` si `|diferencia| < TOTAL_EPSILON` (`0.005`) **o si no hay sub-items**.
- `difiereSubtotal(items, total_ars)` — atajo `hasItems && !matches`.

Lo usan la fila "TOTAL SUB-ITEMS" del grid (`buildFlatRows`), `renderSubItems` (mobile), el display de "Total ARS" cuando el gasto no está confirmado, `GastoItemDialog` (card "Suma sub-items") y `VencimientosHoyAlert`, así que todas las vistas comparten el mismo criterio.

**Indicador de diferencia en la fila del gasto** (`SubtotalDifiereIcon` en `GastosTable`): cuando el gasto tiene sub-items y el subtotal **no** coincide con `total_ars`, se muestra un `ErrorOutlineIcon` rojo **al lado del total cargado** — en la columna "Total ARS" del grid y en el bloque "Total" de la card mobile — sin necesidad de expandir. El tooltip muestra subtotal de sub-items, total cargado y la diferencia con signo; al clickear el icono se expande/colapsa el gasto para ver el detalle. Si el gasto no está confirmado, la celda sigue mostrando el subtotal (en naranja) pero el icono se calcula igual contra `total_ars`.

Sub-items ordenados primero por `incluye_en_vencimiento` (los incluidos en vencimiento primero) y luego por `fecha` asc (nulls last) — en `buildFlatRows`, `renderSubItems` y `GastoItemDialog`. En `GastoItemDialog` el desempate ante misma fecha (o ambos sin fecha) es por `id` asc. La fila total de sub-items aparece **antes** de los items individuales al expandir; luego van los incluidos en vencimiento y por último el resto.

**Sorting de la grilla**: `GastosTable` usa `sortingMode="server"` y `sortModel` controlado. Al click en header el sort aplica solo a filas de gasto (vía `sortGastos()`), y `buildFlatRows` arma flat rows desde los gastos ya ordenados. Sub-items y fila de totales quedan pegados al padre. Comparador soporta `number` y strings (`localeCompare`); nulos al final.

## Categorías y etiquetas

`Gasto` y `GastoItem` se clasifican en **dos ejes distintos**:

**Unicidad y fusión.** `Categoria.nombre` y `Etiqueta.nombre` son **`@unique`**, y el `POST` de ambas hace **find-or-create case-insensitive** (`resolveCategoria`/`resolveEtiqueta` en `src/lib/clasificadores.ts`, normalizando trim + colapso de espacios, igual que `resolveConcepto`). Antes eran un `create` pelado con el texto crudo y ninguna de las dos columnas era única: como se crean inline desde los selects del form, era cuestión de tiempo terminar con "Comida" y "comida " partiendo el reporte por categoría en dos sin que nada lo señalara. El `PUT` rechaza con **409** la colisión de nombre y sugiere fusionar.

**Merge:** `POST /api/categorias/merge` y `/api/etiquetas/merge` (`{ source_id, target_id }`). La categoría es FK única y se reapunta con `updateMany`; la etiqueta es M2M y se conecta fila por fila (Prisma no soporta `updateMany` sobre M2M), aprovechando que `connect` es **idempotente** cuando la fila ya tenía las dos. Las filas de la tabla intermedia del origen se van solas al borrarlo. Migración `20260819110000_categoria_etiqueta_unicas`, que **normaliza → fusiona duplicados → recién ahí crea los índices únicos** (en ese orden, o falla en cualquier base con duplicados).

**UI:** el ABM de ambas está en **`ClasificadorManager`** (`src/components/configuracion/ClasificadorManager.tsx`), un solo componente para los dos ejes — los bloques de categorías y etiquetas en `/configuracion` eran copias literales de ~120 líneas cada una.

- **Categoría** — **FK único** (`categoriaId` nullable → `categoria`). Es la *partición* ("¿en qué rubro se fue la plata?"): una por gasto/ítem, de modo que el reporte por categoría suma 100% sin duplicar. En la API: `categoria_id: number | null` (body) + `categoria: {id,nombre} | null` (display). Modelo Prisma `Categoria` (relación 1-a-muchos). CRUD en `/api/categorias` (`GET/POST` + `PUT/DELETE [id]`). El `GET` incluye el conteo de uso (`uso` = gastos + sub-items) y el `DELETE` rechaza con **409** si `uso > 0`.
- **Etiquetas** — relación **muchos-a-muchos** (`Etiqueta`, relaciones implícitas `GastoEtiquetas`/`GastoItemEtiquetas`). Es el *corte transversal* ("¿qué gastos son del viaje / deducibles?"): varias por gasto/ítem, se solapan a propósito. En la API: `etiqueta_ids: number[]` (body) + `etiquetas: {id,nombre}[]` (display). CRUD en `/api/etiquetas`. El `GET` incluye `uso` y el `DELETE` rechaza con **409** si `uso > 0`. Write paths: POST conecta con `{ connect }`, PUT reemplaza con `{ set }`.

**UI:** `GastoForm` y `GastoItemDialog` usan `AppSelect` (categoría única, emptyLabel "Sin categoría") + `AppMultiSelect` (etiquetas), ambos con `onCreate` para alta inline. `GastosTable` muestra categoría (color primary) + etiquetas (🏷️) en grilla/cards/sub-ítems; la búsqueda incluye ambas. La **edición masiva** (`BulkAccionesBar` + `PATCH /api/gastos/categorias` y `/api/gastos/etiquetas`) permite asignar/limpiar la categoría única y agregar/quitar una etiqueta a varios gastos a la vez (ver [Acciones masivas](#acciones-masivas-clasificación--borrado)). ABM de ambas en `/configuracion`: cada ítem muestra un chip con la cantidad de usos y el botón de borrar queda **deshabilitado** cuando la categoría/etiqueta está en uso (mismo patrón que Conceptos). En toda la pantalla de configuración (casas, monedas, categorías, etiquetas, tarjetas, conceptos y cierres de tarjeta) el borrado pide confirmación con `ConfirmDialog` antes de ejecutarse.

**Reportes:** `por_categoria` (partición) usa la categoría única; `por_etiqueta` (cobertura) usa las etiquetas. Ver [reportes](reportes.md).

**Origen:** venían de un único M2M `Categoria` (antes FK único `categoriaId`, renombrado de `Lugar`). La migración a este modelo (categoría única + etiquetas) se hizo con `scripts/migrate-categorias-etiquetas.sql` (archival): copió el M2M viejo a `Etiqueta` y reusó `Categoria` como la lista de categorías únicas, con `categoriaId` arrancando vacío.

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
- `fecha: string` (YYYY-MM-DD) — filtro por `fecha_vencimiento` exacto. Vacío = sin filtro. Renderizado en `FiltrosGastos` como `AppDateField` con `min`/`max` acotados al mes/año seleccionado y botón de limpiar (icono ✕). Permite ver rápido los gastos que vencen un día puntual. **Se limpia automáticamente al cambiar de mes/año** (flechas ‹ › o popover), porque la fecha quedaría fuera del período cargado.
- `categoriaIds: number[]` / `etiquetaIds: number[]` — filtro por **categoría** (FK único, match por `categoria.id`) y por **etiquetas** (M2M, match si el gasto tiene al menos una etiqueta seleccionada). Vacío = sin filtro. Renderizados en `FiltrosGastos` con `AppMultiSelect` (opciones desde `/api/categorias` y `/api/etiquetas`). Cada select incluye una opción centinela **"Sin categoría" / "Sin etiquetas"** con `value = SIN_CLASIFICAR` (`0`, constante exportada por `FiltrosGastos`; los ids reales son > 0) que matchea los gastos **sin** clasificar en ese eje. Se pueden combinar (ej. "Sin categoría" + una categoría concreta → OR). El filtrado es a nivel gasto (no desglosa sub-items).
- `tarjetaIds: number[]` — filtro por **tarjeta de pago** (match por `tarjeta_id` del gasto). Vacío = sin filtro. Renderizado en `FiltrosGastos` con `AppMultiSelect` (opciones desde `/api/tarjetas`, con `render` que muestra el `BrandLogo` de la marca + `nombre (banco)`, igual que en Reportes). Incluye la opción centinela **"Sin tarjeta"** (`SIN_CLASIFICAR` = `0`) para los gastos con `tarjeta_id == null` (típicamente débito). Como los resúmenes de tarjeta (`es_tarjeta`) también traen `tarjeta_id`, filtrar por una tarjeta muestra tanto sus consumos individuales como su fila de resumen. Es independiente del toggle "Crédito/Débito" (`tipo_pago`) y se puede combinar con él.

**Layout de `FiltrosGastos`:** los filtros viven en una `Card`. La **barra principal** (siempre visible) tiene el selector de mes, la búsqueda (crece) y el toggle de estado de pago. Los filtros secundarios (casa, categorías, etiquetas, tarjetas, fecha, tipo de pago) están en un **panel colapsable** que se abre con el botón **"Filtros"** (icono `Tune`); ese botón lleva un `Badge` con la cantidad de filtros secundarios activos (`activos` = casa + tipo_pago + fecha + categorías + etiquetas + tarjetas) y se muestra `contained` cuando hay alguno. Dentro del panel, los controles se disponen en una grilla responsive (1/2/3 columnas según breakpoint) y hay un botón **"Limpiar filtros"** que resetea sólo los secundarios (no toca mes/año ni estado de pago). Responsive/mobile-friendly: en `xs` mes y búsqueda ocupan el ancho completo y la grilla del panel colapsa a una columna.

### Selector de mes (`FiltrosGastos`)

Las flechas ‹ › navegan mes a mes (con wraparound de año). Además, el label "Mes Año" (ej. "Diciembre 2025") es un `ButtonBase` clickeable que abre un `Popover` para saltar directo a cualquier mes/año: navegación de año (‹ año ›) + grilla 3×4 de meses abreviados. El mes/año activo se resalta con `primary.main`. Seleccionar un mes setea `mes`+`anio` (del año mostrado en el picker) y cierra el popover. El estado `anioPicker` se inicializa con `filtros.anio` cada vez que se abre.

## GastoDialog — cierre

**Cancelar** cierra directo sin pedir confirmación (`onClose` en vez de `handleRequestClose`). El `ConfirmDialog` "¿Cerrar sin guardar?" sigue activo para backdrop/ESC.

## GastoForm — layout y orden de campos

El form está optimizado para cargar rápido: los campos con default correcto en la mayoría de las cargas están colapsados y el primer campo es el que dispara el autofill.

**Área principal** — sólo lo que se tipea en toda carga, en este orden: `descripcion` (con `autoFocus` en alta) + `total_moneda` → `tipo_cambio` + "Total en ARS" (sólo si la moneda no es ARS) → `fecha_vencimiento` + **Medio de pago**.

**Acordeón "Más opciones"** (`defaultExpanded` sólo en edición), en filas de dos: `categoria_id` + `etiqueta_ids` → `casa_id` + `moneda_id` → `pagado_completo` (fila propia) → `total_pagado` + cuotas → `notas` → `pasaje_mes_siguiente` + `prestamo_a_otro` (edición) → `confirmado` → `es_tarjeta`. El orden está armado para que los `sm={6}` queden emparejados y no sobre ninguno suelto: por eso `moneda_id` sube al lado de `casa_id` y las cuotas bajan al lado de `total_pagado` (cuando `pagado_completo` está marcado, `total_pagado` se oculta y las cuotas quedan solas en la fila).

Todos estos campos están acá porque el autofill los llena (categoría/etiquetas desde el concepto, casa desde el default configurable) o porque su default sirve en la carga típica. Corolario: los helpers `de jun 2026` de esos campos sólo se ven al expandir el acordeón; el aviso de que hubo prefill vive en el helper de `descripcion`, que siempre está visible.

**Medio de pago (colapsa `tipo_pago` + `tarjeta_id`)**: un `AppSelect` con "Débito / Efectivo" + una opción por tarjeta. Elegir tarjeta setea `tipo_pago='C'` + `tarjeta_id`; elegir débito setea `'D'` + `null`. Ambos `setValue` van con `shouldDirty: true` para que el autofill no los pise después. Las opciones de tarjeta llevan `render` (logo + nombre en el dropdown) y **`adornment`** (logo al lado del valor ya seleccionado, como `startAdornment` del input) — ver `AppSelect` en `docs/claude/inversiones-shared.md`.
**Excepción `es_tarjeta`**: en un resumen de tarjeta se renderizan los **dos controles separados** (toggle C/D + select de tarjeta), porque ahí la tarjeta es opcional y puede convivir con `tipo_pago='D'` — combinación no representable en el control unificado.

**"Guardar y cargar otro"** (`GastoDialog`, sólo en alta): guarda, deja el diálogo abierto e incrementa `resetSignal`, prop que `GastoForm` observa para hacer `reset()` conservando el contexto de carga (fecha, casa, medio de pago, moneda) y limpiando `descripcion`, montos, categoría/etiquetas, cuotas y notas (`confirmado` y `pagado_completo` vuelven a `true`). Refocusea descripción vía `descripcionRef`.

## Valores por defecto del alta

**Casa por defecto** — `Settings.casaDefaultId` (`casa_default_id` en la API), configurable en `/configuracion` → "Valores por defecto (nuevo gasto)". `GastoForm` la aplica sólo en alta; si no hay default configurado cae al comportamiento previo (autocompletar cuando existe **una sola** casa). `PUT /api/settings` valida que el id exista (si no, ignora el cambio) y acepta `null` para limpiarlo.

**Defaults aprendidos por concepto** — al elegir un concepto ya usado, el alta se prefillea con los valores de su **último gasto**: `casa_id`, `tipo_pago`, `tarjeta_id`, `moneda_id`, `tipo_cambio`, `categoria_id`, `etiqueta_ids` y `total_moneda`. Backend: `GET /api/conceptos/[id]/ultimo-uso` + módulo puro `src/lib/concepto-defaults.ts` (`toConceptoDefaults`, `ULTIMO_USO_ORDER_BY` = `anio`/`mes`/`id` desc). Tests: `concepto-defaults.test.ts` y `ultimo-uso/route.test.ts`.

Reglas del autofill:

- **No se heredan** `es_tarjeta`, `notas`, cuotas, `pasaje_mes_siguiente` ni `prestamo_a_otro`: son propios de la ocurrencia puntual, no del concepto (una cuota 3/12 el mes que viene es 4/12).
- La query excluye `esTarjeta: true` (un resumen de tarjeta no es un gasto cargable a mano) y la `tarjeta_id` sólo se hereda si el pago era con crédito.
- **Cuándo dispara**: sólo al elegir del dropdown (`onChange`) o al salir del campo (`onBlur`) — nunca por tecla, porque tipear "Luz de la casa" pasaría por "Luz" en el camino y prefillearía con el concepto equivocado.
- **Nunca sobreescribe** un campo que el usuario ya tocó (se chequea `formState.dirtyFields`). Los `setValue` del autofill no marcan dirty, así que cambiar la descripción reemplaza el autofill anterior pero preserva lo tipeado a mano.
- **Monto heredado ⇒ sin confirmar**: si el autofill escribió `total_moneda`, pone `confirmado = false` (encaja con el render naranja + warning de las filas no confirmadas). **`pagado_completo` no se toca**: sigue marcado por default siempre, por decisión de producto. Consecuencia a tener presente: un gasto con monto heredado se guarda con un pago automático por ese monto aún sin confirmar; si el monto real difiere, hay que ajustar el pago.
- **Feedback**: los campos escritos por el autofill (y aún no tocados) muestran un helper `de jun 2026`; la descripción muestra un ícono ✨ y el helper "Prefilleado con el último uso (jun 2026)".
- **Concepto nuevo**: si al salir del campo el texto no matchea ningún `Concepto` (comparación con `normalizeNombre` case-insensitive), aparece un chip **"nuevo concepto"** y el helper avisa que se crea al guardar y que conviene revisar typos. Es la guardia contra "Netlfix": un duplicado por typo rompe en silencio el match por `conceptoId` de evolución/estimado/copiar. No hay prefill porque no hay histórico.

## GastoForm — campos condicionales

- **Tipo de cambio**: `tipo_cambio` solo se renderiza cuando la moneda no es ARS. Al cambiar a ARS, set `tipo_cambio = 1`. "Total en ARS" readonly al lado cuando aplica.
- **Cuotas**: un **único campo de texto** "Cuotas (opcional)" con formato `3/12`, parseado por `src/lib/cuotas.ts` (`parseCuotas`/`formatCuotas`, módulo puro testeado en `cuotas.test.ts`). Vacío = sin cuotas (ambos `null`); un solo número (`12`) equivale a `1/12`; rechaza no enteros, `< 1`, pares incompletos y cuota > total, mostrando el error en el helper sin tocar el form. Reemplazó al toggle "Pago en cuotas" + dos inputs numéricos.
- **Total pagado / Pagado completo**: en alta, toggle `pagado_completo` (no se persiste), **marcado por default** (salvo que el autofill haya heredado el monto — ver arriba). Si marcado, el campo "Total Pagado (ARS)" se oculta. En `GastoDialog.handleSubmit`:
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

**Autocompletado:** los campos "Descripción" de `GastoForm` y `GastoItemDialog` usan `Autocomplete` `freeSolo`. `GastoItemDialog` consume `GET /api/items/descripciones`, que devuelve los **nombres de `Concepto`** (`concepto.nombre`, ordenados con `localeCompare('es', { sensitivity: 'base' })`) — antes era un `distinct` sobre texto libre. `GastoForm` en cambio consume **`GET /api/conceptos`** (id + nombre + uso) porque necesita el `id` para pedir los defaults del último uso; ordena las sugerencias por **uso descendente** y desempata por nombre, para que los conceptos frecuentes aparezcan primero. Con ese cambio **`GET /api/gastos/descripciones` quedó sin consumidores** (se mantiene la route, pero es candidata a borrar).

**Administración** (`/configuracion` → "Conceptos", componente `ConceptosManager`): listar (con conteo de uso), renombrar (`PATCH /api/conceptos/[id]`, rechaza colisión con 409), borrar sólo si sin uso (`DELETE`, 409 si en uso; el borrado pide confirmación con `ConfirmDialog`), y **fusionar** duplicados (`POST /api/conceptos/merge` con `{ source_id, target_id }`: reasigna gastos+items y borra el origen).

## Vencimientos del día alert

`VencimientosHoyAlert` (`src/components/gastos/VencimientosHoyAlert.tsx`) — montado al inicio de `gastos/page.tsx`. En `useEffect` (una sola vez por mount) hace `GET /api/gastos?mes=<hoy>&anio=<hoy>` y arma la lista de vencimientos del día con **la misma lógica que `pagar_hoy` en `/api/resumen`**:

- Se saltea el gasto si `!confirmado && items.length === 0` (mismo criterio que `computeResumen`).
- Reparte con `vencePorGasto(g.es_tarjeta, items.length)`:
  - **Vence por gasto** (sin sub-items o `es_tarjeta`): entra como entrada principal si `g.fecha_vencimiento === today` y el restante > 0. El restante se calcula igual que en el resumen: `total_ars` si está confirmado, o la suma de sub-items con `incluye_en_total` si no, menos `total_pagado`.
  - **Vence por sub-items**: se recorren sus `items` y entran como sub-item los que tengan `incluye_en_vencimiento = true && fecha === today` (sin importar el `fecha_vencimiento` del gasto padre).

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

## Acciones masivas (clasificación + borrado)

Permite, desde la grilla, seleccionar varios gastos a la vez y **asignar/quitar la categoría única**, **agregar/quitar una etiqueta** o **eliminarlos** a todos ellos.

- **UI** (`GastosTable`): botón "Seleccionar varios" (arriba a la derecha de la tabla) activa el **modo selección**. En ese modo aparece:
  - una columna de checkbox al inicio de la grilla (desktop) / un checkbox en el header de cada card (mobile) — sólo seleccionables las filas `_type === 'gasto'`;
  - `BulkAccionesBar` (`src/components/gastos/BulkAccionesBar.tsx`), barra sticky con: checkbox "Todos" (con estado indeterminate) + contador "N de M seleccionados" + cerrar (✕), y **tres filas de acción**:
    - **Categoría** (`AppSelect` de `/api/categorias`): **Asignar** / **Quitar categoría**.
    - **Etiqueta** (`AppSelect` de `/api/etiquetas`): **Agregar etiqueta** / **Quitar etiqueta**.
    - **Borrado**: botón rojo **"Eliminar seleccionados"**, que abre un `ConfirmDialog` ("Eliminar N") en `GastosTable`.
  - "Todos" selecciona/deselecciona **los gastos filtrados** (respeta estado de pago, búsqueda y fecha).
  - El modo selección se resetea automáticamente al cambiar de mes/año o ante un refresh global (`filtros`/`refreshKey`).
- **Aplicar clasificación**: helper `applyBulk` en `GastosTable` hace `PATCH /api/gastos/categorias` o `/api/gastos/etiquetas` con `{ gasto_ids, action, ... }`. Al terminar recarga la grilla (`loadGastos`) manteniendo la selección para encadenar más acciones. Toast de éxito/error.
- **Aplicar borrado**: `handleBulkDelete` hace `DELETE /api/gastos` con `{ gasto_ids }`. Tras confirmar: toast con la cantidad borrada, se sale del modo selección, se limpia la selección y se dispara `onDeleted()` (refresh global de tabla + resumen).
- **Backend**:
  - **Categoría única**: setea/limpia `categoriaId` por gasto (`add` = id, `remove` = null), propagando también a los sub-items de tarjeta. Validación `parseCategoriaBatch`.
  - **Etiqueta (M2M)**: `connect`/`disconnect` por gasto (idempotente / no-op), propagando por item a los sub-items de tarjeta (M2M no soporta `updateMany`). Validación `parseEtiquetaBatch`.
  - **Borrado** (`DELETE /api/gastos`): validación `parseGastoIdsBatch` (array no vacío de ids > 0, con coerción a number y dedup) → **400** si el body es inválido. Verifica que **todos** los ids existan: si falta alguno responde **404** con la lista de faltantes y **no borra nada** (así el cliente no cree que borró todo con ids viejos). Si están todos, un único `deleteMany` — la cascada de la DB borra pagos y sub-items propios y los sub-items propagados a la tarjeta (`GastoItem.pago` es `onDelete: Cascade`), igual que `DELETE /api/gastos/[id]`.
  - Todo en `src/lib/gastos-batch.ts` (validación pura) + transacción atómica / `deleteMany` en las routes. Sólo se seleccionan **gastos** (no sub-items sueltos), pero la propagación/cascada alcanza a sus sub-items de tarjeta.

## Evolución del gasto (gráfico mensual)

`EvolucionGastoDialog` (`src/components/gastos/EvolucionGastoDialog.tsx`) muestra la evolución del **Total ARS** de un gasto a través de los meses, como un `LineChart` de `@mui/x-charts` (curva `monotoneX`, tooltip al pasar el mouse que muestra el valor del mes).

- Se abre desde `GastosTable`: icono `ShowChartIcon` ("Evolución mensual") en la columna de acciones (desktop) y opción en el menú de tres puntos (mobile).
- Ventana por defecto **6 meses** terminando en el mes/año del filtro activo (incluye el mes actual). Se cambia en pantalla con un `AppSelect` (presets 3/6/9/12/18/24), que vuelve a pedir los datos y recalcula.
- Identifica el gasto entre meses por **`concepto_id` + `casa_id`** del gasto desde el que se abrió (misma lógica de match que copiar/merge).
- Pide los datos a `GET /api/gastos/evolucion?concepto_id=...&mes=...&anio=...` (antes el param era `descripcion`). Bajo el gráfico muestra promedio / máximo / mínimo de los meses con datos (>0).
- `@mui/x-charts` v7 se agregó como dependencia para este gráfico.
