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
- **`TarjetasCerradas`** (`size=24`), al lado del `BrandLogo`.

**Cómo llega cada campo al cliente:**
- `tarjeta_banco_logo` viaja en la response de cada gasto (`toGastoResponse` → `g.tarjeta?.bancoLogo ?? null`) — es un slug corto.
- `banco_icono` **no** viaja en la response de gastos (un data URI por fila inflaría el payload del grid). `GastosTable` hace un `fetch('/api/tarjetas')` propio (efecto atado a `refreshKey`), arma un `Record<tarjetaId, dataUri>` y lo resuelve por `row.tarjeta_id`.
- `/api/tarjetas` (GET/POST/PUT) y `/api/tarjetas/cerradas` exponen `banco_logo` y `banco_icono`, y los write paths aceptan ambos en el body (mapeados a `bancoLogo`/`bancoIcono`).

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

## Tarjetas cerradas (dashboard de gastos)

`TarjetasCerradas` (`src/components/gastos/TarjetasCerradas.tsx`) — montado en `/gastos` debajo de `ResumenCards`. `GET /api/tarjetas/cerradas?mes=<filtros.mes>&anio=<filtros.anio>&today=<YYYY-MM-DD>` y muestra como chips/cards las tarjetas cuyo `TarjetaCierre` del mes filtrado tiene `fechaProximoCierre` **menor a hoy**. Cada chip:
- `<BrandLogo marca={t.marca} width={44} height={32} />`.
- Banco (o nombre si no hay banco) como texto principal.
- **Nombre de la tarjeta** como caption (se omite si el título ya es el nombre, es decir cuando la tarjeta no tiene banco).
- Tooltip con las 3 fechas.

**Estética unificada con `/configuracion`:** ambos usan `BrandLogo` con dimensiones idénticas (44x32) y el mismo wrapper (borde + `bgcolor` tintados con `marcaColor(t.marca)`). Helper `marcaColor` exportado desde `TarjetaLogo.tsx`.

Si no hay matches, el componente no renderiza. Refresca con `refreshKey` del store.
