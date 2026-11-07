# Promociones (reintegros mensuales)

Sección `/promociones` (desde `TopBar`, icono `LocalOfferIcon`). Responde: **"¿dónde me conviene gastar hoy, cuánto tengo que gastar para exprimir cada tope y cuánto llevo reintegrado?"**

## Modelo (`prisma/schema.prisma`)

- **`Promocion`**: `lugar`, `porcentaje`, `topeMensual` (reintegro máximo por mes, en ARS), `dias Int[]` (**0 = lunes … 6 = domingo**), `tarjetas` (M2M implícita `_PromocionTarjetas` con `Tarjeta`), `efectivo`, `activa`, `notas`, `conceptos` (M2M implícita `_PromocionConceptos` con `Concepto`: **varios** conceptos por promo), `categorias` (M2M `_PromocionCategorias` con `Categoria`), `etiquetas` (M2M `_PromocionEtiquetas` con `Etiqueta`), `vigenteDesde?`/`vigenteHasta?` (YYYY-MM-DD inclusive; `null` = sin límite de ese lado).
- **`Gasto.promocionId?`** (FK `SetNull`, indexada): la promo a la que **cuenta** ese gasto. Es la fuente del consumo automático.
- **`PromocionReintegro`**: el **vencimiento del reintegro de una promo en un mes** (`promocionId`, `mes`, `anio`, `venceEl?` YYYY-MM-DD inclusive, `utilizado`; unique `(promocionId, mes, anio)`, cascade desde la promo). Se carga **a mano** porque la fecha cambia de un mes a otro y entre promos: no hay regla de la que derivarla. Es lo único que se persiste del reintegro — el monto se sigue calculando.
- **`PromocionUso`**: consumo cargado a mano (`fecha` string, `mes`/`anio` derivados, `montoGasto`). `onDelete: Cascade` desde la promo.

Migraciones: `20261028100000_add_promociones/`, `20261029100000_promocion_gasto_vigencia/` y `20261030100000_promocion_varios_conceptos/` y `20261031100000_promocion_reintegro_vencimiento/` y `20261104100000_promocion_categorias_etiquetas/` (aditivas; la última sólo crea las dos tablas puente). La última crea la tabla puente, copia el `conceptoId` que ya tenía cada promo y suelta su FK; la columna `Promocion.conceptoId` queda como **legacy** (la app no la lee ni la escribe) para no romper el código que corre en producción contra la misma base.

Decisiones:

- **Es una regla recurrente, no hay una fila por mes.** Lo que cambia por período (consumo, reintegro, lo que falta) **se calcula**, no se persiste.
- **La asociación gasto → promo es explícita, no por concepto.** El gasto no guarda fecha de compra (sólo `mes`/`anio` y vencimiento), así que no se puede saber qué gastos del mes caen después de que la promo arrancó. Antes se sumaban todos los del concepto, y una promo que empieza a mitad de mes contaba compras anteriores. Ahora cuenta sólo lo asociado; los **criterios vinculados** —conceptos, categorías y etiquetas, todos opcionales y de a varios— quedaron como **pista** para sugerir y listar candidatos.
- **Criterios = OR** (`criterioCoincide`): un gasto coincide si su concepto, su categoría o **alguna** de sus etiquetas está entre los vinculados. Vincular una categoría **amplía** la promo, no la restringe (no es "concepto Y categoría"). Una promo sin ningún criterio no se sugiere ni lista candidatos (`tieneCriterios`); sólo suma lo asociado a mano y los usos manuales. La categoría/etiquetas que se miran son las del **gasto**, no las de sus sub-ítems.
- **`efectivo`** = gasto de **débito sin tarjeta** (`tipoPago === 'D'` y `tarjetaId == null`). Un débito con una tarjeta que no es de la promo no cuenta como efectivo (`medioCoincide`).
- **Tope obligatorio (`> 0`)**: el gasto mínimo para el tope divide por el porcentaje.
- **Vigencia** (`vigenteEnMes`): se evalúa **por mes** (la promo vale en un mes si se superpone con él). Fuera de vigencia no se sugiere, no entra en la semana/Hoy ni en los totales, y la card sale atenuada con "Fuera de vigencia". **No filtra gastos** (no hay fecha de compra): sólo evita sugerir/contar fuera del rango. Una promo que arranca el 15/10 sí vale en octubre; los gastos de octubre anteriores al 15 se excluyen **no asociándolos**.
- Mergear conceptos, categorías o etiquetas (`/api/{conceptos,categorias,etiquetas}/merge`) **conecta el destino** a las promos que tenían el origen (idempotente si ya tenían los dos); si no, al borrar el origen la tabla puente lo soltaría y la promo dejaría de sugerirse en silencio. Borrar una categoría/etiqueta (sólo posible sin uso en gastos) la suelta de las promos por cascade.
- **Copiar mes no hereda la promo** (`/api/gastos/copiar` arma los campos a mano y no copia `promocionId`): el gasto del mes nuevo podría caer antes del inicio de la promo; se vuelve a sugerir al editarlo. La **propina** (segundo gasto del alta) tampoco la hereda (`buildPropinaGasto`).

## Cómo se calcula (`src/lib/promociones-compute.ts`, puro)

Consumo del mes = **automático + manual**:

- **Automático** (`consumoAutomatico(promoId, gastos)`): suma `totalMoneda × tipoCambio` de los gastos del mes con `promocionId` = la promo; las devoluciones (negativos) restan.
- **Manual**: los `PromocionUso` del período, para lo que no está cargado como gasto.

`progresoPromocion(promo, auto, manual)`:

| Campo | Fórmula |
|---|---|
| `reintegrado` | `min(consumo × %, tope)` (consumo negativo = 0) |
| `gasto_minimo` | `tope ÷ %` — el gasto que agota justo el tope; menos deja plata sobre la mesa, más no suma |
| `gasto_restante` | `max(0, gasto_minimo − consumo)` |
| `disponible` | `tope − reintegrado` (lo que queda por ganar) |
| `estado` | `sin_uso` / `en_curso` / `tope_alcanzado` |

Los días sólo alimentan el calendario: no se verifican contra los gastos. Doble conteo: un consumo cargado como gasto asociado **y** como uso manual suma dos veces; los usos manuales son para lo que no está en gastos.

### Cómo se asocia un gasto

1. **Al cargarlo** (`GastoForm` → `PromocionGastoField`): consulta `GET /api/promociones/sugeridas` (concepto/categoría/etiquetas del gasto + medio de pago + vigente en el mes del gasto; se vuelve a consultar al cambiar cualquiera de ellos). En el **alta**, la promo coincidente con tope disponible queda **elegida de entrada**; quien carga puede pasarla a "Sin promoción" (p. ej. una compra anterior al inicio). Editando no se cambia nada solo, y la promo ya asociada siempre se ofrece (`promocion_id` fuerza incluirla, con `coincide: false`). El campo no aparece si no hay promo para ofrecer, ni en un resumen de tarjeta. `GastoFormData.promocion_id` viaja al POST/PUT de gastos (el PUT sólo lo toca si la clave viene en el body).
2. **A posteriori** (`AsociarGastosDialog`, botón "Gastos que cuentan" en la card, sólo con algún criterio vinculado): lista los gastos del mes que coinciden con **cualquiera de los criterios** (pre-filtro en la DB con `whereGastoCriterios`) con medio válido (más los ya asociados) con un check cada uno, y sincroniza con `POST /api/promociones/[id]/asociar`. Es la forma de arreglar el primer mes o gastos cargados antes de la promo.

### Vencimiento del reintegro

Para no perder un reintegro por no usarlo a tiempo, cada reintegro puede llevar su fecha de vencimiento:

- **Card de la promo** (`PromoCard`): bajo los datos, "Vencimiento del reintegro:" con un chip `dd/mm · vence en N días` (`VencimientoChip`) o "Cargar fecha" si no hay; "Ya lo usé" si se marcó como utilizado. Click abre `VencimientoReintegroDialog` (fecha + "Ya lo usé" + "Quitar vencimiento"). Es del **mes que se está mirando**. La fila sólo aparece si ya hay algo reintegrado o cargado.
- **Panel "Reintegros para usar antes de que venzan"** (`ReintegrosPorVencer`, arriba de todo): los pendientes de **todos los meses** (el de octubre puede vencer en diciembre) con monto, mes de origen, chip de urgencia y botón "Ya lo usé". El borde toma el color del más urgente. No se muestra si no hay ninguno.
- **Color** (`estadoVencimiento(venceEl, hoy)`): `vencido` y `urgente` (≤ 7 días, incluye hoy) en rojo, `proximo` (≤ 15) en naranja, `ok` neutro. Los días se cuentan en UTC sobre el string (`diasHasta`) y `hoy` es la fecha local del cliente.
- Se listan sólo los **no utilizados con fecha y monto reintegrado > 0** (con 0 no hay nada que perder), ordenados por fecha (`reintegrosPendientes`). Los vencidos siguen apareciendo hasta marcarlos como usados o quitarles la fecha.

### Popup en `/gastos` (`PromocionesHoyAlert`)

Al entrar a la pantalla principal de gastos sale un popup "Promociones" con:

- **Vigentes hoy**: las promos activas, vigentes en el mes y que valen el día de la semana de hoy, **con tope por aprovechar** (las de tope agotado no interrumpen), ordenadas por disponible, con "Podés recuperar $X · gastando $Y más".
- **Saldo de reintegros para usar**: los mismos pendientes que `ReintegrosPorVencer` (no utilizados, con fecha y monto > 0, de cualquier mes) con su chip de vencimiento y el total.

La selección la hace `avisoPromociones(promos, reintegros, hoy)` (pura, en `promociones-compute.ts`); si no hay ninguna de las dos cosas no abre. Mira siempre el **mes de hoy** (`GET /api/promociones?mes=&anio=` con la fecha local + `GET /api/promociones/vencimientos`), no el período elegido en el dashboard. Sale **una vez por día**: al cerrarlo (o al ir a "Ver promociones") guarda la fecha en `localStorage` (`gastos:aviso-promociones`, con try/catch: sin storage vuelve a salir). Para no apilar dos diálogos, espera a que se cierre `VencimientosHoyAlert` (prop `onDone`, que también se llama si no había vencimientos o falló el fetch).

## API

| Ruta | Qué hace |
|---|---|
| `GET /api/promociones?mes=&anio=` | Promos con `vigente` (en el período), `reintegro` (vencimiento cargado del período o `null`), `usos` del período y `progreso`, más `totales` (sólo activas y vigentes). Una sola query de gastos asociados (`promocionesConProgreso`). |
| `POST /api/promociones` | Alta (`parsePromocionBody`; `concepto_ids`/`categoria_ids`/`etiqueta_ids: number[]` opcionales; 400 si algún concepto, categoría, etiqueta o tarjeta no existe, o la vigencia es inválida). La respuesta trae `*_ids` y `*_nombres` de los tres ejes. |
| `PUT/DELETE /api/promociones/[id]` | Edita (tarjetas, conceptos, categorías y etiquetas se **reemplazan** con `set`) / borra (cascade a los usos; los gastos quedan sin promo). |
| `GET /api/promociones/sugeridas` | Para el form de gasto: promos activas que coinciden con el concepto (`descripcion`), la categoría (`categoria_id`) **o** alguna etiqueta (`etiqueta_ids`, separadas por coma) del gasto, medio (`tipo_pago`, `tarjeta_id`), vigentes en `mes`/`anio` y **que valen el día de la semana de `fecha`** (fecha local de carga que manda el form; una promo de martes no se ofrece un sábado; sin `fecha` no filtra por día; la promo ya asociada se sigue mostrando con `coincide: false`), con `disponible`/`tope_alcanzado`. |
| `GET /api/promociones/[id]/candidatos?mes=&anio=` | Gastos del mes que podrían contar (coinciden con cualquiera de los criterios vinculados + medio válido, más los ya asociados); 400 sin ningún criterio vinculado. |
| `POST /api/promociones/[id]/asociar` | `{ gasto_ids, asociar }`: asocia (pisa la anterior) o desasocia (sólo los de esta promo). |
| `PUT /api/promociones/[id]/reintegro` | `{ mes, anio, vence_el, utilizado }`: carga/cambia el vencimiento del reintegro del mes (upsert por promo+mes+año). Sin fecha y sin `utilizado` **borra** la fila y devuelve `null`. |
| `GET /api/promociones/vencimientos` | Reintegros pendientes con fecha, de cualquier mes, con `reintegrado` calculado en el mes de origen; omite los de monto 0. `force-dynamic`. |
| `POST /api/promociones/[id]/usos` | Registra un uso manual `{ fecha, monto_gasto, notas? }`. |
| `DELETE /api/promociones/[id]/usos/[usoId]` | Quita un uso (busca por ambos ids). |

## UI (`src/app/promociones/page.tsx`, `src/components/promociones/`)

De arriba hacia abajo: período (compartido con `/gastos` vía el store) → 3 KPIs (reintegrado / por reintegrar / tope total) → **Hoy** (sólo en el mes actual: las promos del día, ordenadas por plata disponible, con "gastando $X más") → **Semana** (`SemanaPromos`: 7 columnas Lun–Dom con chips de lugar + % + logos de tarjeta/efectivo + lo que queda; hoy resaltado; en móvil pasa a lista vertical) → **Progreso del mes** (`PromoCard`: barra del tope, gastado / gasto mínimo / reintegrado / por reintegrar, "te faltan gastar $X", chip de vigencia, usos manuales colapsables). Click en un chip de la semana abre la edición.

`PromocionDialog` (con vigencia desde/hasta opcionales) ofrece las tarjetas con `tarjetasVisiblesEn` (no las dadas de baja, salvo las ya elegidas), con el mismo formato que el select de tarjeta de `GastoForm` (`BrandLogo` + "Nombre (Banco)"). Es **un solo multi-select de medios de pago**: "Débito / Efectivo" va primero (valor centinela `efectivo`, que se guarda en `Promocion.efectivo`) y se puede combinar con cualquier cantidad de tarjetas — una promo que vale con varias tarjetas y/o efectivo es una sola. Debajo, tres multi-selects opcionales de **conceptos, categorías y etiquetas vinculados** (alcanza con que el gasto coincida con uno). `UsoPromoDialog` registra un uso con el reintegro estimado.

## Tests

`promociones-compute.test.ts` (puro) y `api/promociones/route.test.ts`, `[id]/route.test.ts`, `[id]/usos/route.test.ts`, `sugeridas/route.test.ts`, `[id]/candidatos/route.test.ts`, `[id]/asociar/route.test.ts`, `[id]/reintegro/route.test.ts`, `vencimientos/route.test.ts`; `gastos/route.test.ts` y `gastos/[id]/route.test.ts` cubren `promocion_id`, `propina.test.ts` que la propina no la hereda, y `{conceptos,categorias,etiquetas}/merge/route.test.ts` que la promo siga al destino.
