# Tarjetas: logos, cierres, propagación de pagos

## Logos de marca

Cada `Tarjeta` tiene campo opcional `marca` (nullable: `visa | mastercard | amex | diners | discover | jcb | otra`). Se setea en `/configuracion` → Tarjetas → form. Los gastos response exponen `tarjeta_marca?: TarjetaMarca | null`, `tarjeta_nombre` y `tarjeta_banco`. Migración `20260516020000_add_tarjeta_marca` agrega columna `marca TEXT NULL`.

**Regla: la marca se dibuja siempre con `MarcaLogo`, en un único formato.** Tres piezas, y ninguna otra parte de la app dibuja marcas:

- **`src/lib/marcas.ts`** (datos, puro, testeado en `marcas.test.ts`): `MARCAS` (opciones de los selects), `MARCA_ESTILOS` (label, `fondo` del logo y `acento` — no siempre coinciden: Mastercard va sobre blanco con acento rojo), `resolveMarca` (valor guardado o texto libre → marca; reconoce además Cabal y Naranja X; `otra`/vacío/desconocido → `null`), `marcaColor` (acento, para tintar cards como en `/configuracion` y `ProximosCierres`), `marcaLabel` y `marcaAncho` (relación 44:32).
- **`MarcaLogo`** (`src/components/shared/MarcaLogo.tsx`): el logo — SVG inline con el rectángulo del color oficial y el nombre/emblema (viewBox 44×32). Prop `size` = **alto** en px; el ancho sale de la relación, así nadie lo deforma. Sin marca reconocida, `CreditCardIcon`. Usado en `GastosTable` (escritorio, chip "Crédito", mobile), `ProximosCierres`, `/configuracion`, `TarjetaIconos` (selectores de tarjeta) y `TarjetaConMarca`.
- **`TarjetaConMarca`** (`src/components/shared/TarjetaConMarca.tsx`): ícono compacto de una tarjeta — logo del banco con la `MarcaLogo` chiquita en la esquina superior derecha (≈80% del ancho, anillo del color del fondo), o la marca a tamaño completo si no hay banco. Tooltip "Banco (Marca)" (`tarjetaTitulo`) (prop `tooltip={false}` donde el contenedor ya tiene el suyo o es una opción de select). **Es el formato de la tarjeta en toda la app**: promociones (`MediosPromo`), `ProximosCierres` (alto 28), `/configuracion` (alto 28), selectores (`TarjetaIconos`, alto 22) y `GastosTable` (filas de resumen de tarjeta y vista mobile, alto 20, vía el helper `tarjetaDeGasto`). La única excepción es el chip "Crédito" de la grilla, que lleva banco y marca como dos badges en las esquinas del chip.

Cambiar un color, un label o el dibujo de una marca se hace **sólo** en esos archivos y aplica en todos lados. El guard `src/components/shared/marca-logo-guard.test.ts` falla si otro archivo usa íconos de tarjeta de `react-icons` (`FaCc*`, `SiVisa`…) o hardcodea los fondos de las marcas. (Antes coexistían `TarjetaLogo` —íconos monocromos `FaCc*`— y `BrandLogo`, y los lugares nuevos quedaban con el formato equivocado; se eliminaron los dos.)

**Cómo se nombra una tarjeta en los tooltips: "Banco (Marca)"** — `tarjetaTitulo` (`src/lib/marcas.ts`, testeado), lo mismo que se ve en el ícono. Banco = el texto libre o, si falta, el de la lista (`otro` no cuenta); marca = `marcaLabel`. Sin marca reconocida el paréntesis lleva el nombre de la tarjeta (dos tarjetas del mismo banco no quedan iguales; si coincide con el banco se omite); sin banco, "Nombre (Marca)". Lo usan `TarjetaConMarca`, el chip "Crédito" y la vista mobile de `GastosTable`, `ProximosCierres` y el texto de las opciones de todos los selectores de tarjeta (`tarjetaLabel`). Antes cada lugar armaba su texto (`Nombre (Banco)`, `Nombre · Marca`) y con tarjetas llamadas como su marca salía repetida ("American express · American Express"). Todo tooltip nuevo que nombre una tarjeta debe usar esta función.

**Badge de marca en el chip "Crédito"** (`GastosTable`, columna `tipo_pago`): cuando `tipo_pago === 'C'` y hay `tarjeta_id`, se superpone un `MarcaLogo` (alto 18, sobre fondo `background.paper` con `boxShadow`) en la esquina superior derecha del chip, dentro de un `Tooltip` "Banco (Marca)" (`tarjetaTitulo`). En la vista mobile (card), el `MarcaLogo` que ya se muestra junto a la descripción lleva el mismo `Tooltip`.

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
- **`GastosTable`, columna `tipo_pago`**: superpuesto en la esquina **superior izquierda** del chip "Crédito" (`size=18`), en espejo del `MarcaLogo` de la marca que va arriba a la derecha. Ambos usan el helper `badgeSx` del módulo y el mismo `Tooltip` "Banco (Marca)". Sólo cuando `tipo_pago === 'C'` y hay `tarjeta_id`.
- **`GastosTable`, columna `_expand`** (filas de **resumen de tarjeta**, `es_tarjeta`): `TarjetaConMarca` (alto 20, marca en la esquina), dentro del mismo `Tooltip` de cierre/vencimiento. La columna mide 112px para que entren warning + toggle + el logo.
- **`GastosTable` vista mobile (card)**: `TarjetaConMarca` (alto 20) junto a la descripción.
- **`/configuracion`** → fila de la tarjeta (`TarjetaConMarca`, alto 28) y preview del uploader.
- **`ProximosCierres`**: `TarjetaConMarca` (alto 28).

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

Las responses de `/api/gastos` incluyen campo opcional **`cierre`** matcheando el `TarjetaCierre` para `(gasto.tarjetaId, gasto.mes, gasto.anio)` (forma: `{ fecha_cierre, fecha_vencimiento, fecha_proximo_cierre } | null`). Se incluye `tarjeta: { include: { cierres: true } }` en la query y se filtra en `toGastoResponse`. `GastosTable` lo usa para el tooltip del logo de la marca (`MarcaLogo`) en filas `es_tarjeta = true`.

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

**Reimputar un pago (`POST /api/gastos/[id]/pagos/[pagoId]/reimputar`):** si el pago se imputó al resumen equivocado (típico: el cierre del período real todavía no estaba cargado y cayó en el anterior), después de cargar el cierre se lo reimputa **sin borrarlo ni recrearlo**. Recalcula el destino con `resolveTargetPeriodo` (cierres cargados hoy) y **mueve el mismo sub-item** (`gastoItem.update gastoId`) al resumen correcto, creándolo si no existe (`findOrCreateResumen`); conserva lo editado a mano en el sub-item. Responde `{ moved, created, mes, anio }`; `moved: false` si ya estaba bien. Si el sub-item no existía (propagación fallida) lo crea. 400 si el gasto no es de crédito o la tarjeta no tiene cierres, 404 si el pago no es de ese gasto. La lógica de propagación vive en `src/lib/pagos-tarjeta.ts` (compartida con el POST). UI: botón ⇄ por pago en `PagoDialog` (sólo gastos de crédito), que fuerza full-reload.

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

## Copia automática del resumen al mes siguiente

Una vez que **pasó la fecha de cierre** de un período, el resumen de la tarjeta de ese período se copia solo al mes siguiente, **exactamente como "Copiar"** desde la grilla (misma función `copiarGasto`, `src/lib/copiar-gasto.ts`): sólo los sub-items con **cuotas pendientes**, con la cuota +1, el resumen nuevo con `confirmado: false`, y **merge** si el resumen del mes siguiente ya existe (p. ej. porque un pago posterior al cierre ya lo creó) — en ese caso agrega sólo los sub-items cuyo concepto no esté.

- **Job:** `GET /api/cron/copiar-tarjetas`, Vercel Cron diario `0 7 * * *` UTC (4:00 ART). Misma auth que el de vencimientos (`Authorization: Bearer $CRON_SECRET`, fuera del middleware de sesión); "hoy" en timezone Argentina. Sólo corre en producción. Params de prueba: `today=YYYY-MM-DD`, `dry=1` (lista lo que copiaría sin tocar nada).
- **Qué cierres copia** (`debeAutocopiar`, `src/lib/tarjetas-autocopia.ts`, puro y testeado): `fechaCierre` **estrictamente anterior** a hoy (el día del cierre todavía acumula consumos) y como mucho `VENTANA_AUTOCOPIA_DIAS` (10) atrás — la ventana evita copiar todo el histórico al habilitar la función y deja margen si el cron no corrió algún día. El cierre del período M copia los resúmenes (`esTarjeta`, misma tarjeta, M) a M+1 (`periodoDestino`, con wraparound de año); si hay uno por casa, copia todos.
- **Una sola vez:** al copiar se marca `TarjetaCierre.autoCopiadoAt` (migración `20261118120000_tarjeta_cierre_auto_copiado`, columna nullable). Si después se borra algo de lo copiado, el cron no lo vuelve a poner. Un cierre **sin resumen** cargado en su período no se marca: se reintenta los días siguientes mientras siga en la ventana. Si la copia falla, tampoco se marca (y sigue con las demás tarjetas).
- **Tarjeta de baja** desde el mes destino (`tarjetaActivaEn`): no se copia.
- Respuesta: `{ ok, today, copiados, resultados: [{ tarjeta, origen, destino, gastos, sub_items, estado }] }`, con `estado` ∈ `copiado | sin_resumen | tarjeta_de_baja | error | dry`.

## Próximos cierres (dashboard de gastos)

`ProximosCierres` (`src/components/gastos/ProximosCierres.tsx`) — montado en `/gastos` debajo de `ResumenCards`. `GET /api/tarjetas/proximos-cierres?mes=<filtros.mes>&anio=<filtros.anio>&today=<YYYY-MM-DD>` y muestra como cards **todas** las tarjetas, no sólo las que ya cerraron: la sección responde "¿en qué punto del ciclo está cada tarjeta este mes?", y para eso la que todavía no cerró tiene que estar a la vista.

**Orden:** por **el cierre que la tarjeta tiene por delante**, ascendente — primero las que ya cerraron (fecha pasada), después las que están por cerrar de más cerca a más lejos, y al final las que **no tienen ninguna fecha cargada** del período (desempate por nombre para que no dependa del orden de la DB). Ese cierre es `fecha_proximo_cierre`, salvo en `por_cerrar`, donde es la propia `fecha_cierre` — ordenar una `por_cerrar` por su próximo cierre la mandaría **un mes al fondo** (detrás de las que cierran en semanas) justo cuando está por cerrar. Las que no tienen fecha se muestran igual, en vez de desaparecer: un cierre sin cargar no es un no-evento, es justo lo que después hace fallar la propagación del pago con 400.

**Estado del ciclo** — lo calcula `estadoCiclo(cierre, today)` (`src/lib/cierres.ts`, puro y testeado) y lo devuelve la route en `estado` / `dias_para_cierre` / `progreso`:

La regla de la que sale todo: **el cierre que se mide es siempre el primero que la tarjeta tiene por delante.** Los estados se evalúan en este orden, y `por_cerrar` gana.

| `estado` | Cuándo | Cómo se ve la card |
|---|---|---|
| `por_cerrar` | `fechaCierre` >= `today` — el cierre de **este** período todavía no llegó. Gana sobre los otros dos, **tenga o no `fechaProximoCierre` cargado** | Igual que `abierto` (logos grisados) pero en **ámbar**: borde y fondo `alpha(warning.main, .5/.12)`, leyenda "cierra en N días · NN%" en `warning.main` y `LinearProgress color="warning"`. El tooltip agrega "El resumen de este período todavía no cerró" (+ "· falta cargar el próximo cierre" si no lo tiene). |
| `cerrado` | `fechaCierre` ya pasó y `fechaProximoCierre` < `today` | Como siempre: borde y fondo tintados con `marcaColor(t.marca)`, logos a color. |
| `abierto` | `fechaCierre` ya pasó y `fechaProximoCierre` >= `today` (el día del cierre todavía cuenta como abierto) | **Grisada** (borde `divider`, fondo `action.hover`, logos en `grayscale(1)` con `opacity: .65`) + pie con "faltan N días · NN%" y una `LinearProgress` de 4px. |
| `sin_fecha` | No hay ninguna fecha con la que ubicarse en el ciclo | Grisada, con "sin cierre cargado" y sin barra. |

`dias_para_cierre` son los días hasta ese cierre: la propia `fechaCierre` en `por_cerrar`, `fechaProximoCierre` en `cerrado`/`abierto`.

`progreso` es la fracción del ciclo que termina en ese cierre ya transcurrida, recortada a `[0, 1]`:
- `por_cerrar`: el ciclo **actual**, el que todavía está acumulando y cierra en `fechaCierre`. Su inicio es el cierre anterior, que no está en la fila (`fechaCierre` y `fechaProximoCierre` son el final de este ciclo y del que sigue), así que se deriva como `fechaCierre - 1 mes` — la misma suposición de ciclo mensual que ya hace `generarSiguienteCierre`.
- `cerrado`/`abierto`: el ciclo `fechaCierre → fechaProximoCierre`, el que acumula los consumos del resumen que viene. Queda en `null` (sin barra, sólo los días) si falta `fechaCierre` o el intervalo no es válido — un cierre a medio cargar no habilita a dibujar una barra inventada.

**Por qué `por_cerrar` tiene precedencia.** Sin ella, una tarjeta con el cierre a dos días y el próximo cierre cargado mostraba **"faltan 32 días · 0%"**: los 32 días eran hasta el cierre del mes siguiente y el 0% el del ciclo que todavía no arrancó. Las dos cifras eran correctas y las dos inútiles — el dato accionable es que el resumen de este mes cierra ya, que es la última ventana para cargarle consumos. Y si las fechas están invertidas (`fechaProximoCierre` anterior a `fechaCierre`), decir "ya cerró" cuando el cierre del período no llegó es peor que medir el ciclo actual, así que ahí también gana.

Con la `fechaCierre` ya pasada y sin `fechaProximoCierre` no queda nada que medir y el estado vuelve a `sin_fecha`, que es como se venían mostrando esas tarjetas.

Cada card:
- `<TarjetaConMarca t={t} size={28} tooltip={false} />` (banco con la marca en la esquina; sin banco, la marca sola).
- Banco (o nombre si no hay banco) como texto principal.
- **Nombre de la tarjeta** como caption (se omite si el título ya es el nombre, es decir cuando la tarjeta no tiene banco).
- Tooltip encabezado por "Banco (Marca)" (`tarjetaTitulo`), las 3 fechas y el estado del ciclo.

**Estética unificada con `/configuracion`:** ambos usan `TarjetaConMarca` con el mismo tamaño (alto 28) y el mismo wrapper (borde + `bgcolor` tintados con `marcaColor(t.marca)`). Helper `marcaColor` exportado desde `src/lib/marcas.ts`.

Si no hay ninguna tarjeta, el componente no renderiza. Refresca con `refreshKey` del store.


## Proyección de cuotas comprometidas

Botón **"Cuotas"** en el header de `/gastos` (icono en mobile) → `CuotasProyeccionDialog`: cuánto queda comprometido en cuotas de tarjeta **en cada mes desde el consultado hasta la última cuota**. Existe porque la copia automática arrastra las cuotas de a un mes (recién al pasar cada cierre), así que en la grilla no se ve lo de marzo o abril. **No persiste nada** — por eso las compras en cuotas con crédito **no** generan gastos en los meses siguientes como el débito (duplicarían el sub-item que trae la copia del resumen).

- **Fuente** (`GET /api/tarjetas/cuotas-proyeccion?mes&anio[&casa_id]`): sub-items con `cuotaActual`/`cuotasTotales` e `incluyeEnTotal` de los resúmenes (`esTarjeta`). Por tarjeta y casa se toma el **último resumen ≤ al mes** (la base: si el del mes todavía no se copió, sirve el anterior, hasta 12 meses atrás) **más todos los posteriores** (los que creó un pago posterior al cierre). Los anteriores a la base no entran, para que una cuota borrada en el mes no resucite (`seleccionarResumenes`).
- **Dedup** (`proyectarCuotas`, `src/lib/cuotas-proyeccion.ts`): una compra = tarjeta + casa + concepto + monto + cuotas totales + **período de origen** (período del resumen − (cuota − 1)), igual en todas sus apariciones. Dos compras idénticas en el mismo resumen son dos: multiplicidad por resumen, máximo entre resúmenes.
- **Respuesta**: `meses` (`{ mes, anio, total, cantidad }` desde el consultado, inclusive), `compras` (concepto, tarjeta, monto de la cuota, origen/última, `cuotas` restantes con su número, `pendiente`), `total_pendiente` (desde el mes) y `total_futuro` (desde el siguiente). Compras ordenadas por la que termina antes.
- **UI**: tarjetas Este mes / Próximo mes / Resta después de este mes, barras por mes **apiladas por tarjeta** (clic en un mes filtra la lista), y lista de compras con cuota X/N, fin, monto y lo que resta, con barra de cuotas pagadas.
- **Límites**: sólo ve las cuotas que ya son sub-ítems de un resumen (un gasto con crédito sin pago registrado no se propagó todavía); no proyecta consumos sin cuotas ni cargos del banco.

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

## Selectores de tarjeta: banco + marca

Todos los selectores de tarjeta (`GastoForm` medio de pago y tarjeta, `FiltrosGastos`, `ReportesFiltros`, `PromocionDialog`) usan `TarjetaOpcion` / `TarjetaIconos` (`src/components/shared/TarjetaIconos.tsx`): el ícono de la tarjeta (`TarjetaConMarca`, alto 22, sin tooltip: logo del **banco** con la **marca** en la esquina, o la marca sola si no hay banco) y después el texto **"Banco (Marca)"** (`tarjetaLabel`, que delega en `tarjetaTitulo`: el mismo texto que los tooltips, y también el `label` de la opción con el que se busca y se muestra el chip elegido). Las opciones van **ordenadas por ese texto** (`ordenarTarjetas`), así quedan agrupadas por banco. En el campo cerrado del select (`adornment`) se muestra el mismo ícono. Todo selector de tarjeta nuevo debe usar estos componentes (`TarjetaOpcion` + `tarjetaLabel` + `ordenarTarjetas`), nunca armar el texto a mano.
