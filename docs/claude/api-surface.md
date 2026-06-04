# API surface

| Route | Purpose |
|---|---|
| `GET/POST /api/gastos` | List (with filters) / create gastos |
| `GET /api/gastos/evolucion` | Serie mensual de `total_ars` de un gasto a través de los meses. Params: `descripcion` (match case-insensitive), `mes`, `anio` (mes actual / fin de ventana), `meses` (cantidad de meses a mostrar, default 6, acotado 2–24), `casa_id` (opcional). Devuelve `{ mes, anio, label, total_ars }[]` ordenado cronológicamente, con 0 en meses sin match. Suma todos los gastos que matchean por mes; usa la suma de sub-items `incluye_en_total` cuando el gasto no está confirmado. |
| `POST /api/gastos/copiar` | Copia un gasto (`{ source_id, mes, anio }`) con merge: si ya existe (descripción+mes+año+casa, case-insensitive) agrega sólo sub-items faltantes; si no, crea el gasto. Filtra sub-items por cuotas pendientes si `esTarjeta` e incrementa `cuotaActual` +1 para cuotas no finalizadas. |
| `GET/PUT/DELETE /api/gastos/[id]` | Single gasto CRUD |
| `GET/POST /api/gastos/[id]/pagos` | List / add payments for a gasto |
| `PUT/DELETE /api/gastos/[id]/pagos/[pagoId]` | Edit / remove a payment |
| `GET/POST /api/gastos/[id]/items` | List / add sub-items for a gasto |
| `PUT/PATCH/DELETE /api/gastos/[id]/items/[itemId]` | Full edit / partial toggle / remove a sub-item |
| `GET /api/resumen` | Aggregated summary cards; accepts `mes`, `anio`, `casa_id`, and `today` (YYYY-MM-DD local date) params |
| `GET/POST /api/casas` | Houses CRUD |
| `GET/POST /api/monedas` | Currencies CRUD |
| `GET/POST /api/tarjetas` | Credit cards CRUD (incluye `marca` opcional). El GET incluye array `cierres: TarjetaCierre[]` para señalizar tarjetas sin cierre completo del mes actual. |
| `GET/POST /api/tarjetas/[id]/cierres` | List / create cierres (mes, anio, fechaCierre, fechaVencimiento, fechaProximoCierre) — unique por `(tarjetaId, mes, anio)` |
| `PUT/DELETE /api/tarjetas/[id]/cierres/[cierreId]` | Edit / remove a cierre |
| `GET /api/tarjetas/cerradas` | Tarjetas cuyo `TarjetaCierre` del `(mes, anio)` consultado tiene `fechaProximoCierre` < today. Params: `mes`, `anio`, `today` (YYYY-MM-DD). Returns `{ id, nombre, banco, marca, fecha_cierre, fecha_vencimiento, fecha_proximo_cierre }[]`. |
| `GET/POST /api/categorias` | Categorías CRUD (`PUT/DELETE /api/categorias/[id]`) |
| `GET/PUT /api/settings` | Singleton de configuración global (parámetros del estimado del próximo mes) |
| `GET /api/gastos/descripciones` | Unión de descripciones distintas de gastos y sub-items (para autocompletar). |
| `GET /api/items/descripciones` | Alias — devuelve lo mismo que `/api/gastos/descripciones`. `?parent=...` se acepta pero se ignora. |
| `GET/POST /api/inversiones` | List / create inversiones (parent — only `nombre`) |
| `PUT/DELETE /api/inversiones/[id]` | Rename / delete inversion (cascade deletes movimientos) |
| `GET/POST /api/inversiones/[id]/movimientos` | List (sorted by `fecha` asc, ties by `id`) / create movimientos |
| `PUT/DELETE /api/inversiones/[id]/movimientos/[movId]` | Edit / remove a movimiento |
| `GET/POST /api/sueldos` | List / create sueldos — **restringido** al email permitido (403 si no) |
| `PUT/DELETE /api/sueldos/[id]` | Edit / remove sueldo — mismo guard |

Todos los responses de `/api/gastos` incluyen `pagos` y `items` vía constante `INCLUDE` y mapper `toGastoResponse()` en cada route file.
