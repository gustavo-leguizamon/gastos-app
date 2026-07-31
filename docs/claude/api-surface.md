# API surface

| Route | Purpose |
|---|---|
| `GET/POST /api/gastos` | List (with filters) / create gastos |
| `DELETE /api/gastos` | **Borrado masivo**. Body `{ gasto_ids: number[] }`. Valida con `parseGastoIdsBatch` (`src/lib/gastos-batch.ts`) → 400 si el body es inválido. Verifica que todos los ids existan: si falta alguno → **404** con los faltantes y no borra nada. Si están todos, un único `deleteMany` (la cascada de la DB borra pagos, sub-items propios y los propagados a tarjeta). Devuelve `{ ok: true, deleted }`. |
| `GET /api/gastos/evolucion` | Serie mensual de `total_ars` de un gasto a través de los meses. Params: `concepto_id` (match por id), `mes`, `anio` (mes actual / fin de ventana), `meses` (cantidad de meses a mostrar, default 6, acotado 2–24), `casa_id` (opcional). Devuelve `{ mes, anio, label, total_ars }[]` ordenado cronológicamente, con 0 en meses sin match. Suma todos los gastos que matchean por mes; usa la suma de sub-items `incluye_en_total` cuando el gasto no está confirmado. |
| `POST /api/gastos/copiar` | Copia un gasto (`{ source_id, mes, anio }`) con merge: si ya existe (conceptoId+mes+año+casa) agrega sólo sub-items faltantes (por conceptoId); si no, crea el gasto. Filtra sub-items por cuotas pendientes si `esTarjeta` e incrementa `cuotaActual` +1 para cuotas no finalizadas. |
| `PATCH /api/gastos/categorias` | Asignación masiva de la **categoría única**. Body `{ gasto_ids: number[], categoria_id: number, action: 'add' \| 'remove' }`. `add` setea `categoriaId`; `remove` la limpia (null), en varios gastos en una transacción. Valida con `parseCategoriaBatch` (`src/lib/gastos-batch.ts`), 400 si el body es inválido. Devuelve `{ ok: true, updated }`. |
| `PATCH /api/gastos/etiquetas` | Agregar/quitar una **etiqueta** (M2M) en lote. Body `{ gasto_ids: number[], etiqueta_id: number, action: 'add' \| 'remove' }`. `add` → `connect` (idempotente); `remove` → `disconnect` (no-op si no la tenía). Propaga el cambio a los sub-items propagados de tarjeta (por item, porque M2M no soporta `updateMany`). Transacción atómica. Valida con `parseEtiquetaBatch`, 400 si el body es inválido. Devuelve `{ ok: true, updated }`. |
| `GET/PUT/DELETE /api/gastos/[id]` | Single gasto CRUD |
| `GET/POST /api/gastos/[id]/pagos` | List / add payments for a gasto |
| `PUT/DELETE /api/gastos/[id]/pagos/[pagoId]` | Edit / remove a payment |
| `GET/POST /api/gastos/[id]/items` | List / add sub-items for a gasto |
| `PUT/PATCH/DELETE /api/gastos/[id]/items/[itemId]` | Full edit / partial toggle / remove a sub-item |
| `GET /api/resumen` | Aggregated summary cards; accepts `mes`, `anio`, `casa_id`, and `today` (YYYY-MM-DD local date) params |
| `GET /api/reportes` | Métricas agregadas para la sección Reportes. Params: rango `mes_desde`/`anio_desde`/`mes_hasta`/`anio_hasta` (obligatorio, 400 si falta), `casa_id`, `tipo_pago`, `categoria_ids`/`tarjeta_ids`/`concepto_ids` (listas `1,2,3`), `incluir_tarjetas` (default excluye `esTarjeta`), `top` (límite conceptos). Devuelve `{ kpis, por_categoria, por_mes, top_conceptos, por_tarjeta, por_tipo_pago }`. Ver `docs/claude/reportes.md`. |
| `GET/POST /api/casas` | Houses CRUD |
| `GET/POST /api/monedas` | Currencies CRUD |
| `GET/POST /api/tarjetas` | Credit cards CRUD (incluye `marca` opcional). El GET incluye array `cierres: TarjetaCierre[]` para señalizar tarjetas sin cierre completo del mes actual. |
| `GET/POST /api/tarjetas/[id]/cierres` | List / create cierres (mes, anio, fechaCierre, fechaVencimiento, fechaProximoCierre) — unique por `(tarjetaId, mes, anio)` |
| `PUT/DELETE /api/tarjetas/[id]/cierres/[cierreId]` | Edit / remove a cierre |
| `GET /api/tarjetas/cerradas` | Tarjetas cuyo `TarjetaCierre` del `(mes, anio)` consultado tiene `fechaProximoCierre` < today. Params: `mes`, `anio`, `today` (YYYY-MM-DD). Returns `{ id, nombre, banco, marca, fecha_cierre, fecha_vencimiento, fecha_proximo_cierre }[]`. |
| `GET/POST /api/categorias` | Categorías CRUD (`PUT/DELETE /api/categorias/[id]`) — categoría **única** (partición). `GET` incluye `uso` (gastos + sub-items); `DELETE` → 409 si en uso, 404 si no existe. |
| `GET/POST /api/etiquetas` | Etiquetas CRUD (`PUT/DELETE /api/etiquetas/[id]`) — **corte transversal** (M2M). `GET` incluye `uso` (gastos + sub-items); `DELETE` → 409 si en uso, 404 si no existe. |
| `GET/PUT /api/settings` | Singleton de configuración global: parámetros del estimado del próximo mes + `casa_default_id` (casa preseleccionada en el alta de gastos; el PUT valida que exista y acepta `null` para limpiarla) |
| `GET /api/gastos/descripciones` | Nombres de `Concepto` (para autocompletar descripciones). |
| `GET /api/items/descripciones` | Alias — devuelve lo mismo que `/api/gastos/descripciones`. `?parent=...` se acepta pero se ignora. |
| `GET/POST /api/conceptos` | Lista de conceptos con conteo de uso / crear (find-or-create por nombre). |
| `PATCH/DELETE /api/conceptos/[id]` | Renombrar (409 si colisiona con otro) / borrar (409 si está en uso). |
| `POST /api/conceptos/merge` | Fusiona `{ source_id, target_id }`: reasigna gastos+items al destino y borra el origen. |
| `GET /api/conceptos/[id]/ultimo-uso` | Defaults para prefillear el alta con el último gasto del concepto (excluye `esTarjeta`): `casa_id`, `tipo_pago`, `tarjeta_id`, `moneda_id`, `tipo_cambio`, `categoria_id`, `etiqueta_ids`, `total_moneda` y `origen: { mes, anio }`. `null` si el concepto no tiene histórico; 400 si el id es inválido. |
| `GET/POST /api/inversiones` | List / create inversiones (parent — only `nombre`) |
| `PUT/DELETE /api/inversiones/[id]` | Rename / delete inversion (cascade deletes movimientos) |
| `GET/POST /api/inversiones/[id]/movimientos` | List (sorted by `fecha` asc, ties by `id`) / create movimientos |
| `PUT/DELETE /api/inversiones/[id]/movimientos/[movId]` | Edit / remove a movimiento |
| `GET/POST /api/sueldos` | List / create sueldos — **restringido** al email permitido (403 si no) |
| `PUT/DELETE /api/sueldos/[id]` | Edit / remove sueldo — mismo guard |

Todos los responses de `/api/gastos` incluyen `pagos` y `items` vía constante `INCLUDE` y mapper `toGastoResponse()` en cada route file.
