# Tarjetas: logos, cierres, propagación de pagos

## Logos de marca

Cada `Tarjeta` tiene campo opcional `marca` (nullable: `visa | mastercard | amex | diners | discover | jcb | otra`). Se setea en `/configuracion` → Tarjetas → form. Render con `TarjetaLogo` (`src/components/shared/TarjetaLogo.tsx`) usando `react-icons/fa` (`FaCcVisa`, `FaCcMastercard`, `FaCcAmex`, `FaCcDinersClub`, `FaCcDiscover`, `FaCcJcb`) en colores institucionales. Si `otra` o `null`, fallback `CreditCardIcon` MUI. Constante exportada `MARCAS` lista las opciones para selects.

`TarjetaLogo` usado en: configuración de tarjetas, `GastoForm` (dentro de `MenuItem` del select Tarjeta), `GastosTable` (reemplaza `CreditCardIcon` en `es_tarjeta=true`, en Tooltip de fechas). Los gastos response exponen `tarjeta_marca?: TarjetaMarca | null`, `tarjeta_nombre` y `tarjeta_banco`.

**Badge de marca en el chip "Crédito"** (`GastosTable`, columna `tipo_pago`): cuando `tipo_pago === 'C'` y hay `tarjeta_id`, se superpone un `BrandLogo` (26x18, sobre fondo `background.paper` con `boxShadow`) en la esquina superior derecha del chip, dentro de un `Tooltip` que muestra `Nombre (Banco)` (o solo `Nombre` si no hay banco). En la vista mobile (card), el `BrandLogo` que ya se muestra junto a la descripción lleva el mismo `Tooltip`.

Migración `20260516020000_add_tarjeta_marca` agrega columna `marca TEXT NULL`.

**`BrandLogo`** (`src/components/shared/BrandLogo.tsx`): componente reutilizable que recibe `marca` y devuelve SVG inline estilizado (viewBox 44x32, ~1.4:1). Soporta Visa, Mastercard, Amex, Cabal, Naranja, Diners, Discover, JCB. Fallback `CreditCardIcon`. Provee contraste visual sin assets externos.

## Logo del banco emisor

Además de la marca, cada `Tarjeta` identifica a su **banco emisor** con dos campos opcionales, y **la imagen subida gana sobre la lista**:

| Campo Prisma | API | Qué es |
|---|---|---|
| `bancoIcono` | `banco_icono` | **Imagen subida** por el usuario, guardada como **data URI** (no hay storage de archivos en el proyecto). Prioridad 1. |
| `bancoLogo` | `banco_logo` (`TarjetaBanco`) | Slug de la **lista fija** de bancos/fintechs argentinos → badge generado por código. Prioridad 2. |

Ambos se cargan en `/configuracion` → Tarjetas (alta y edición inline): select "Banco del icono (opcional)" + `IconoBancoUpload` para la imagen. Migraciones `20260804090000_add_tarjeta_banco_logo` (`bancoLogo TEXT NULL`) y `20260804100000_add_tarjeta_banco_icono` (`bancoIcono TEXT NULL`).

### Carga de la imagen (`src/lib/imagen-icono.ts`)

Puro + testeado (`imagen-icono.test.ts`), salvo `fileToIconoDataUri` que usa APIs del browser:
- `ICONO_MAX_PX = 96` (lado máximo del icono final), `MAX_FILE_BYTES = 4 MB` (archivo original), `MAX_DATA_URI_BYTES = 120 KB` (resultado).
- `validateIconoFile({type,size})` → mensaje de error o `null`. Acepta PNG, JPG, WEBP, GIF y SVG.
- `computeFitSize(w, h, max)` → escala el lado mayor a `max` sin agrandar imágenes chicas ni devolver lados en 0.
- `dataUriBytes(uri)` / `isIconoDataUri(uri)` — el segundo se usa como **validación de server**: `POST`/`PUT /api/tarjetas` guardan `bancoIcono` sólo si es un data URI de imagen, sino `null` (no se aceptan URLs remotas).
- `fileToIconoDataUri(file)` (browser): lee el archivo, lo redimensiona en un `<canvas>` a `ICONO_MAX_PX` y devuelve un PNG data URI; los **SVG se guardan tal cual** (son vectoriales). Rechaza si el resultado excede `MAX_DATA_URI_BYTES`.

**`IconoBancoUpload`** (`src/components/shared/IconoBancoUpload.tsx`): preview + botón "Subir/Cambiar icono" + botón para quitarlo (vuelve al badge de la lista). Muestra el error de validación en el caption. Recibe `value`/`onChange` (data URI o `null`) y `bancoLogo`/`bancoTexto` para previsualizar el fallback.

### Lista fija (`src/lib/bancos.ts`)

Puro, testeado en `bancos.test.ts`; es la fuente de verdad del badge:
- `BANCOS`: lista de `{ value, label, color, sigla, alias? }` — `value` es el slug que se persiste, `color` el color institucional, `sigla` el texto de 1 a 4 caracteres del badge. Incluye Galicia, Santander, BBVA, Nación, Provincia, Ciudad, Macro, ICBC, HSBC, Supervielle, Patagonia, Credicoop, Comafi, Hipotecario, Brubank, Ualá, Naranja X, Mercado Pago y `otro`.
- `resolveBanco(bancoLogo, bancoTexto?)`: gana el **slug explícito**; si está vacío, el banco se **infiere del texto libre de `banco`** (normalizado sin acentos, match por slug o `alias` — ej. `"Banco Nación"`/`"BNA"` → `nacion`), así las tarjetas ya cargadas muestran logo sin re-editarlas. `otro` nunca se infiere del texto. Devuelve `null` si no hay match.
- `bancoColor` / `bancoLabel`: helpers derivados.
- `hasBancoIcono(icono, bancoLogo, bancoTexto)`: `true` si hay imagen subida **o** banco resoluble. Los callers lo usan para no renderizar el contenedor del badge cuando no hay nada que mostrar.

### Render (`BancoLogo`)

**`BancoLogo`** (`src/components/shared/BancoLogo.tsx`) resuelve en este orden: **1)** `icono` (imagen subida) → `<img>` a `size` con `objectFit: contain`, `borderRadius` y **placa blanca de fondo** (los logos suelen ser oscuros con fondo transparente y así se leen en tema claro y oscuro); **2)** badge de la lista fija — SVG inline (viewBox 32x32, `rx=7`) con la sigla en blanco sobre el color del banco, o `AccountBalanceIcon` gris para `otro`; **3)** `null`, así el caller no reserva espacio.

Se muestra en:
- **`GastosTable`, columna `tipo_pago`**: superpuesto en la esquina **superior izquierda** del chip "Crédito" (`size=18`), en espejo del `BrandLogo` de la marca que va arriba a la derecha. Ambos usan el helper `badgeSx` del módulo y el mismo `Tooltip` `Nombre (Banco)`. Sólo cuando `tipo_pago === 'C'` y hay `tarjeta_id`.
- **`GastosTable`, columna `_expand`** (filas de **resumen de tarjeta**, `es_tarjeta`): a la izquierda del `BrandLogo` de la marca (`size=18`), dentro del mismo `Tooltip` de cierre/vencimiento. La columna mide 112px para que entren warning + toggle + los dos logos.
- **`GastosTable` vista mobile (card)**: junto al `BrandLogo` que acompaña la descripción.
- **`/configuracion`** → fila de la tarjeta (`size=24`) y preview del uploader.
- **`ProximosCierres`** (`size=24`), al lado del `BrandLogo`.

**Cómo llega cada campo al cliente:**
- `tarjeta_banco_logo` viaja en la response de cada gasto (`toGastoResponse` → `g.tarjeta?.bancoLogo ?? null`) — es un slug corto.
- `banco_icono` **no** viaja en la response de gastos (un data URI por fila inflaría el payload del grid). `GastosTable` hace un `fetch('/api/tarjetas')` propio (efecto atado a `refreshKey`), arma un `Record<tarjetaId, dataUri>` y lo resuelve por `row.tarjeta_id`.
- `/api/tarjetas` (GET/POST/PUT) y `/api/tarjetas/proximos-cierres` exponen `banco_logo` y `banco_icono`, y los write paths aceptan ambos en el body (mapeados a `bancoLogo`/`bancoIcono`).

El campo `banco` sigue siendo **texto libre** — no se reemplazó por el select porque alimenta las descripciones derivadas (`"Nombre (Banco)"` de los resúmenes de tarjeta). `banco_logo` y `banco_icono` son ejes independientes y opcionales.

## Tarjeta de crédito (resumen de tarjeta)

Flag `es_tarjeta` (Prisma `esTarjeta`, default `false`). Cuando está activo:

- El select de **Tarjeta** se muestra siempre (independiente del `tipo_pago`).
- La **descripción** se bloquea y se sincroniza automáticamente con `Nombre (Banco)` de la tarjeta (si no tiene banco, solo `nombre`). `useEffect` que llama `setValue('descripcion', ...)` al cambiar `esTarjeta` o `tarjetaId`.

## Cierres de tarjeta (TarjetaCierre)

Las fechas `fechaCierre`, `fechaVencimiento`, `fechaProximoCierre` viven en `TarjetaCierre` con un registro por `(tarjetaId, mes, anio)` (constraint único). Se cargan en `/configuracion` → Tarjetas → click en la fila para expandir el panel inline.

`TarjetaCierres` ya no contiene Accordion propio — es solo el contenido. El Accordion vive en `configuracion/page.tsx` envolviendo la fila (logo + nombre/banco como AccordionSummary, panel como AccordionDetails). Edit/Delete del summary llevan `e.stopPropagation()`. Se usa `TransitionProps={{ unmountOnExit: true }}` para que `TarjetaCierres` solo se monte al expandirse. Callback opcional `onCierresChange` se dispara después de save/delete; la página lo usa para re-fetch `/api/tarjetas`.

**Indicador "cierre incompleto"**: en el summary se muestra `WarningAmberIcon` (con Tooltip) cuando no existe `TarjetaCierre` del mes/año actual, o cuando falta alguna de las 3 fechas. Check client-side desde array `cierres` que viene en cada `Tarjeta` del GET `/api/tarjetas`. CRUD vía `/api/tarjetas/[id]/cierres` (GET/POST) y `/api/tarjetas/[id]/cierres/[cierreId]` (PUT/DELETE). Cascade `onDelete: Cascade` al borrar tarjeta.

El gasto "resumen de tarjeta" sigue como contenedor (`esTarjeta = true`) pero ya no guarda fechas. Migración `20260516010000_add_tarjeta_cierre` crea la tabla, backfillea desde gastos `esTarjeta = true` (uno por `(tarjetaId, mes, anio)`, menor `id` si duplicados), y dropea columnas `fechaCierre`/`fechaProximoCierre` de `Gasto`.

Las responses de `/api/gastos` incluyen campo opcional **`cierre`** matcheando el `TarjetaCierre` para `(gasto.tarjetaId, gasto.mes, gasto.anio)` (forma: `{ fecha_cierre, fecha_vencimiento, fecha_proximo_cierre } | null`). Se incluye `tarjeta: { include: { cierres: true } }` en la query y se filtra en `toGastoResponse`. `GastosTable` lo usa para el tooltip del `CreditCardIcon` en filas `es_tarjeta = true`.

## Propagación de pagos a la tarjeta

En `POST /api/gastos/[id]/pagos`:

1. Solo aplica cuando el **gasto fuente** tiene `tipoPago = 'C'` y `tarjetaId` asignada.
2. Se traen **todos** los `TarjetaCierre` de la tarjeta con `fechaCierre` no nulo (`findMany where: { tarjetaId, fechaCierre: { not: null } }`, `select: { mes, anio, fechaCierre }`).
   - **Si la tarjeta no tiene ningún `TarjetaCierre` con `fechaCierre`** (lista vacía → `resolvePeriodoTarjetaByCierres` devuelve `null`), el endpoint responde **`400`** con `{ error }` y **no crea el pago** (mensaje: "…la tarjeta no tiene fechas de cierre configuradas. Configurá el cierre en Configuración → Tarjetas."). Los clientes (`PagoDialog`, pago inicial de `GastoDialog`) muestran ese mensaje.
3. Se determina el **período destino** de forma **absoluta** con `resolvePeriodoTarjetaByCierres(pago.fecha, cierres)` (`src/lib/fechas.ts`, pura y testeada) — **independiente** del mes/año en que esté clasificado el gasto fuente. Usa las **fechas de cierre completas** (no solo el día del mes): el pago pertenece al resumen cuyo `fechaCierre` es el **primero en ocurrir en/después de la fecha del pago** (cierre inclusivo; comparación lexicográfica sobre `YYYY-MM-DD`).
   - Esto es correcto aunque el cierre de un resumen caiga en **otro mes** que el que lo etiqueta. Ej. real (Visa Galicia): el resumen de **junio** cierra el **28/05** y el próximo cierre es el **02/07** (resumen de julio). Un pago del **26/06** (posterior al cierre del 28/05) cae en el resumen de **julio**, no en junio.
   - **Fallback** — si el pago es posterior a **todos** los cierres conocidos (faltan cierres futuros configurados), se proyecta con el **día del último cierre** vía el heurístico clásico `resolvePeriodoTarjeta(fecha, díaÚltimoCierre)` (menos preciso; solo aplica ante datos faltantes hacia adelante).
   - `resolvePeriodoTarjeta(fecha, diaCierre)` (día suelto: `día ≤ cierre → mes del pago`, sino `mes+1`) sigue exportada y testeada, pero **ya no es el path principal** — quedó como helper del fallback.
4. `propagatePagoToTarjeta({ source, target, ... })` busca el resumen de tarjeta del período destino (`esTarjeta = true`, mismo `tarjetaId`, target mes/anio). **Si no existe se crea** con defaults: `conceptoId` = `resolveConcepto("Nombre (Banco)")` (la descripción se deriva del nombre de la tarjeta), `casaId` del fuente, `monedaId = ARS`, `tipoCambio = 1`, `totalMoneda = 0`, `tipoPago = 'D'`, `fechaVencimiento` = `TarjetaCierre.fechaVencimiento` del target si existe, sino `"{anio}-{mes}-01"`, `confirmado = false`, `esTarjeta = true`.
5. Se crea un `GastoItem` (sub-item) en ese resumen: `conceptoId = gasto fuente.conceptoId` (hereda el concepto del gasto fuente), `fecha = pago.fecha`, `monto = pago.monto`, `incluyeEnTotal = true`, `pagoId = pago.id` (FK al pago), `categoriaId = gasto fuente.categoriaId`, `etiquetas = gasto fuente.etiquetas` (connect), `cuotaActual = gasto fuente.cuotaActual`, `cuotasTotales = gasto fuente.cuotasTotales` (si el gasto se hizo en cuotas, se trasladan al sub-item).

El paso 2 (validación de cierre) corre **antes** de crear el pago; la propagación (pasos 4-5) va en try/catch — si falla, el pago original se mantiene. Esta lógica también se dispara desde "Total Pagado en gasto nuevo".

**Montos negativos (devoluciones):** toda la cadena de propagación acepta montos negativos sin filtro por signo — `propagatePagoToTarjeta` crea el sub-item con el `monto` tal cual, y `PagoDialog` sólo rechaza `monto === 0`. El pago inicial disparado al **crear** un gasto (`GastoDialog.handleSubmit`) usa el guard `montoPago !== 0` (no `> 0`), de modo que un gasto de crédito cargado con "pagado completo" o `total_pagado` negativo (ej. una devolución de PedidosYa) también genera su sub-item de devolución en el resumen de la tarjeta. Sólo se saltea la creación del pago cuando el monto es exactamente `0`.

**Cascade al eliminar el pago:** `GastoItem.pagoId` referencia `Pago` con `onDelete: Cascade`. Al borrar un pago (vía `DELETE /api/gastos/[id]/pagos/[pagoId]` o cascade del gasto), Postgres borra automáticamente el sub-item propagado.

**Cascade inverso (al borrar el sub-item):** `DELETE /api/gastos/[id]/items/[itemId]` verifica `pagoId`. Si lo tiene, borra el **Pago** referenciado — y el cascade del FK arrastra el item. Eliminar el sub-item propagado deshace el pago original. Si no tiene `pagoId`, borra directo.

**Sincronización bidireccional al editar (fecha + monto):**
- `PUT /api/gastos/[id]/pagos/[pagoId]` actualiza el pago y ejecuta `prisma.gastoItem.updateMany({ where: { pagoId }, data: { fecha, monto } })`. Response incluye `synced_items: number`.
- `PUT /api/gastos/[id]/items/[itemId]` actualiza el item y, si `item.pagoId != null`, `prisma.pago.update({ where: { id: pagoId }, data: { monto, ...(item.fecha ? { fecha: item.fecha } : {}) } })`. Si fecha del item es `null`, preserva la actual del pago (NOT NULL). Response incluye `synced_pago: boolean`.
- Ambos sincs en try/catch — fallar el sync no bloquea la edición. Logs server: `[PUT pago]` / `[PUT item]`.
- Solo se sincroniza `(fecha, monto)`. `descripcion`, `categoria_id`, etc. no se reflejan entre pago↔item.
- **Refresh del cliente:** `PagoDialog` y `GastoItemDialog` reciben el flag de sync y lo propagan a `onChanged(fullReload)`. `GastosTable` dispara `triggerRefresh()` (recarga el grid completo) cuando `fullReload` es truthy; sin el flag solo refresca gasto actual + cards.
  - **Alta/baja de pago en gasto de crédito:** al **crear** o **eliminar** un pago sobre un gasto `tipo_pago === 'C'` con `tarjeta_id`, la propagación crea/borra un sub-item en **otra fila** del grid (el resumen de la tarjeta, que suele vivir en otro mes). `PagoDialog` calcula `esCredito = tipo_pago === 'C' && tarjeta_id != null` y llama `onChanged(esCredito)` en `handleAdd`/`handleDelete` para forzar el full-reload — si no, la fila del resumen de la tarjeta queda desactualizada hasta recargar la página. La **edición** de pago ya fuerza full-reload vía `synced_items > 0`.

**Sync del gasto fuente → sub-items propagados (concepto + categoría + etiquetas):** `PUT /api/gastos/[id]` (editar el gasto crédito que origina los pagos) busca los sub-items linkeados (`findMany where: { pago: { gastoId } }`) y actualiza **cada uno** con `conceptoId`, `categoriaId` y `etiquetas` (`set`) del gasto fuente, así el resumen de la tarjeta refleja la clasificación actual (concepto → descripción derivada; categoría/etiquetas para el reporte). Se hace por item porque `etiquetas` (M2M) no soporta `updateMany`. La **edición masiva** (`PATCH /api/gastos/categorias`) también propaga la categoría a los sub-items, vía `updateMany` (sólo `categoriaId`). `GastoDialog.onSaved = triggerRefresh` recarga la tabla; si el sub-item vive en otro mes se ve al navegar. En try/catch — no bloquea la edición.

## Próximos cierres (dashboard de gastos)

`ProximosCierres` (`src/components/gastos/ProximosCierres.tsx`) — montado en `/gastos` debajo de `ResumenCards`. `GET /api/tarjetas/proximos-cierres?mes=<filtros.mes>&anio=<filtros.anio>&today=<YYYY-MM-DD>` y muestra como cards **todas** las tarjetas, no sólo las que ya cerraron: la sección responde "¿en qué punto del ciclo está cada tarjeta este mes?", y para eso la que todavía no cerró tiene que estar a la vista.

**Orden:** por **el cierre que la tarjeta tiene por delante**, ascendente — primero las que ya cerraron (fecha pasada), después las que están por cerrar de más cerca a más lejos, y al final las que **no tienen ninguna fecha cargada** del período (desempate por nombre para que no dependa del orden de la DB). Ese cierre es `fecha_proximo_cierre`, salvo en `por_cerrar` (que no lo tiene cargado), donde es la propia `fecha_cierre` — así una tarjeta que cierra en 2 días se ordena por su imminencia y no queda tirada al final. Las que no tienen fecha se muestran igual, en vez de desaparecer: un cierre sin cargar no es un no-evento, es justo lo que después hace fallar la propagación del pago con 400.

**Estado del ciclo** — lo calcula `estadoCiclo(cierre, today)` (`src/lib/cierres.ts`, puro y testeado) y lo devuelve la route en `estado` / `dias_para_cierre` / `progreso`:

| `estado` | Cuándo | Cómo se ve la card |
|---|---|---|
| `cerrado` | `fechaProximoCierre` < `today` | Como siempre: borde y fondo tintados con `marcaColor(t.marca)`, logos a color. |
| `abierto` | `fechaProximoCierre` >= `today` (el día del cierre todavía cuenta como abierto) | **Grisada** (borde `divider`, fondo `action.hover`, logos en `grayscale(1)` con `opacity: .65`) + pie con "faltan N días · NN%" y una `LinearProgress` de 4px. |
| `por_cerrar` | **No** hay `fechaProximoCierre`, pero `fechaCierre` >= `today` | Igual que `abierto` (logos grisados) pero en **ámbar**: borde y fondo `alpha(warning.main, .5/.12)`, leyenda "cierra en N días · NN%" en `warning.main` y `LinearProgress color="warning"`. El tooltip agrega "El resumen de este período todavía no cerró · falta cargar el próximo cierre". |
| `sin_fecha` | No hay `fechaProximoCierre` y `fechaCierre` ya pasó (o no hay ninguna fecha válida) | Grisada, con "sin cierre cargado" y sin barra. |

`dias_para_cierre` son los días hasta el cierre que la tarjeta tiene por delante: `fechaProximoCierre` en `cerrado`/`abierto`, la propia `fechaCierre` en `por_cerrar`.

`progreso` es la fracción del ciclo que termina en ese cierre ya transcurrida, recortada a `[0, 1]`:
- `cerrado`/`abierto`: el ciclo `fechaCierre → fechaProximoCierre`. Queda en `null` (sin barra, sólo los días) si falta `fechaCierre` o el intervalo no es válido — un cierre a medio cargar no habilita a dibujar una barra inventada.
- `por_cerrar`: el ciclo **actual**, el que todavía está acumulando y cierra en `fechaCierre`. Su inicio es el cierre anterior, que por definición no está cargado, así que se deriva como `fechaCierre - 1 mes` (la misma suposición de ciclo mensual que ya hace `generarSiguienteCierre`). El ámbar señala las dos cosas a la vez: el cierre inminente y que falta cargar el próximo cierre.

El único caso sin `fechaProximoCierre` del que se puede decir algo es `por_cerrar`: antes caía todo junto en `sin_fecha` y la tarjeta se mostraba "sin cierre cargado" **teniendo el dato** de que cierra en dos días. Pasada la `fechaCierre` sin próximo cierre cargado ya no queda nada que medir y vuelve a `sin_fecha`.

Cada card:
- `<BrandLogo marca={t.marca} width={44} height={32} />` + `BancoLogo` (`size=24`).
- Banco (o nombre si no hay banco) como texto principal.
- **Nombre de la tarjeta** como caption (se omite si el título ya es el nombre, es decir cuando la tarjeta no tiene banco).
- Tooltip con las 3 fechas + el estado del ciclo.

**Estética unificada con `/configuracion`:** ambos usan `BrandLogo` con dimensiones idénticas (44x32) y el mismo wrapper (borde + `bgcolor` tintados con `marcaColor(t.marca)`). Helper `marcaColor` exportado desde `TarjetaLogo.tsx`.

Si no hay ninguna tarjeta, el componente no renderiza. Refresca con `refreshKey` del store.


## Generar el cierre del próximo mes

Los `TarjetaCierre` se cargaban a mano mes por mes, aunque el dato para derivarlos ya estuviera guardado: **`fechaProximoCierre` de un período es la `fechaCierre` del siguiente**. Olvidarse no es cosmético — sin el cierre del mes, `POST /api/gastos/[id]/pagos` responde **400** y la propagación del pago a la tarjeta se rompe.

**`src/lib/cierres.ts`** (puro, testeado en `cierres.test.ts`):

| Función | Qué hace |
|---|---|
| `addMeses(fecha, n)` | Suma meses a un `YYYY-MM-DD` conservando el día, recortado al último del mes destino (31/1 + 1 mes → 28 o 29/2). `null` si la fecha no es válida. |
| `ultimoCierre(cierres)` | El de mayor `(anio, mes)`. No confía en el orden de entrada. |
| `generarSiguienteCierre(ultimo)` | Proyecta el período siguiente: `fechaCierre` = `fechaProximoCierre` del último (o `fechaCierre + 1 mes` si no está cargada); vencimiento y próximo cierre se corren un mes. |

Todo sale **nullable**: si el último cierre está incompleto, el generado también lo está y se completa a mano. Es preferible a inventar una fecha.

**`POST /api/tarjetas/[id]/cierres/generar`** crea la fila. 409 si la tarjeta no tiene ningún cierre del que partir, y 409 (vía el unique `(tarjetaId, mes, anio)`, `P2002`) si el siguiente ya estaba cargado. En la UI es el botón **"Generar próximo"** de `TarjetaCierres`; las fechas quedan editables, porque el generado es un **borrador con la proyección**, no un dato firme.

## Baja de una tarjeta (por período)

La tarjeta que ya no se posee seguía apareciendo en `/gastos` para siempre: en la fila de cierres, en el select de medio de pago del alta y en el filtro por tarjeta. **Borrarla no era salida**: `Gasto.tarjetaId` cascadea (`onDelete: Cascade`), así que borrar la tarjeta se lleva los gastos que la usaron y con ellos el histórico de dónde se gastó. Por eso la baja es un **corte temporal**, no un borrado.

`Tarjeta.bajaMes` / `Tarjeta.bajaAnio` (nullable, migración `20260903100000_tarjeta_baja`; API `baja_mes`/`baja_anio`). Ambos `null` = activa. Desde `(bajaMes, bajaAnio)` **inclusive** la tarjeta deja de mostrarse y de ofrecerse en `/gastos`; los meses anteriores no cambian en nada.

**`src/lib/tarjetas-baja.ts`** (puro, testeado en `tarjetas-baja.test.ts`):

| Función | Qué hace |
|---|---|
| `tarjetaActivaEn(t, mes, anio)` | Si la tarjeta está vigente en el período. El mes configurado **ya cuenta como de baja** (`<`, no `<=`): "deshabilitar en agosto" = en agosto no aparece más. Compara el período completo (`anio * 12 + mes`), así que enero 2027 es posterior a diciembre 2026. |
| `tarjetasActivasEn(lista, mes, anio)` | Filtra conservando el orden de entrada. |
| `tarjetasVisiblesEn(lista, mes, anio, conservarIds)` | Las vigentes **más** las de `conservarIds` que hayan quedado afuera. Lo que usan los selects de `/gastos`. |
| `parseBaja(mes, anio)` | Normaliza el body de `POST`/`PUT /api/tarjetas`. |

Dos decisiones que sostienen todo lo demás:

- **El par es todo-o-nada.** Un mes sin año (o al revés, o un mes fuera de `1..12`) no define un corte, así que `parseBaja` guarda `null` en los dos y `tarjetaActivaEn` deja la tarjeta activa. Un dato a medias no hace desaparecer una tarjeta. Como efecto, mandar la baja vacía o inválida en el `PUT` es justamente el camino para **rehabilitarla**.
- **`tarjetasVisiblesEn` rescata la ya elegida.** Una tarjeta seleccionada que desaparece de las opciones se pierde sin aviso: el form la guardaría en `null` al editar un gasto viejo, y el filtro quedaría aplicado sin nada que lo muestre. La baja saca de la lista lo que no se puede elegir de nuevo, no lo que ya está elegido.

El módulo lee el par en las **dos convenciones** (`bajaMes`/`baja_mes`) porque es la costura entre las filas de Prisma que le pasan las routes y la respuesta de `/api/tarjetas` que le pasan los componentes. La normalización vive ahí una vez, en vez de un `.map()` de adaptación en cada call site.

**Dónde se aplica el filtro y dónde no** — la regla es "en `/gastos` se recorta; donde se lee historia, no":

| Lugar | Comportamiento |
|---|---|
| `ProximosCierres` (`/api/tarjetas/proximos-cierres`) | **Recorta.** Una tarjeta que ya no se tiene no tiene ciclo. Filtrado en memoria (son pocas filas) para que la condición viva en `tarjetaActivaEn` y no en un `OR` de Prisma. |
| `GastoForm` (medio de pago + select de Tarjeta) | **Recorta** por el período del gasto (`gasto.mes/anio` o los defaults), conservando la ya seleccionada. Elegir una tarjeta que no se posee sería un error de carga. |
| `FiltrosGastos` (filtro por tarjeta) | **Recorta** por el mes mostrado, conservando las ya tildadas. Trae todas una vez y filtra en el cliente: el mes cambia seguido. |
| `GastosTable` (iconos de banco) | **No recorta.** Los gastos históricos tienen que seguir mostrando su logo. |
| `/reportes` | **No recorta.** El punto de la baja es no perder el histórico. |
| `/configuracion` | **No recorta** — es donde se revierte. La tarjeta de baja se muestra grisada, con un chip `Baja MM/AAAA`. |

**En `/configuracion`:** en el form de edición de la tarjeta, un toggle *"Dada de baja (ya no la tengo)"* que al activarse propone el **mes actual** y despliega los selects de mes/año. El warning de **"cierre incompleto"** se suprime en las tarjetas de baja: no van a tener el cierre del mes nunca, y dejarlo prendido sería una alerta permanente imposible de resolver.
