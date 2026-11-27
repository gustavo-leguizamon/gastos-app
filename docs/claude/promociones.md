# Promociones (reintegros mensuales)

Sección `/promociones` (desde `TopBar`, icono `LocalOfferIcon`). Responde: **"¿dónde me conviene gastar hoy, cuánto tengo que gastar para exprimir cada tope y cuánto llevo reintegrado?"**

## Modelo (`prisma/schema.prisma`)

- **`Promocion`**: `lugar`, **`tipo`** (`porcentaje` default / `monto_fijo`, ver Tipos de reintegro), `porcentaje` (0 en monto fijo), `topeMensual` (reintegro máximo por **ciclo**, en ARS), **`montoReintegro?`** y **`compraMinima?`** (sólo monto fijo), **`diaReinicio`** (1–31, default 1: día del mes en que se reinicia el tope, ver Ciclo), `dias Int[]` (**0 = lunes … 6 = domingo**), `tarjetas` (M2M implícita `_PromocionTarjetas` con `Tarjeta`), `efectivo`, **`modalidad`** (`presencial` / `virtual` / `ambas`, default `virtual`: dónde vale la promo; es informativa, no filtra gastos ni sugerencias), `activa`, `notas`, `conceptos` (M2M implícita `_PromocionConceptos` con `Concepto`: **varios** conceptos por promo), `categorias` (M2M `_PromocionCategorias` con `Categoria`), `etiquetas` (M2M `_PromocionEtiquetas` con `Etiqueta`), `vigenteDesde?`/`vigenteHasta?` (YYYY-MM-DD inclusive; `null` = sin límite de ese lado).
- **`Gasto.promocionId?`** (FK `SetNull`, indexada): la promo a la que **cuenta** ese gasto. Es la fuente del consumo automático.
- **`Gasto.promocionFecha?`** (YYYY-MM-DD): **fecha de compra con la promo**; decide a qué **ciclo** cuenta el gasto. `null` = el ciclo que empieza en su `mes` (los asociados antes de que existiera, o desde "Gastos que cuentan"). Sin promo nunca queda una fecha suelta (`promocionFechaDeBody`).
- **`PromocionReintegro`**: el **vencimiento de lo reintegrado en un ciclo** (`promocionId`, `mes`, `anio` = ciclo, `venceEl?` YYYY-MM-DD inclusive, `utilizado` = "ya lo usé entero"; unique `(promocionId, mes, anio)`, cascade desde la promo). Se carga **a mano** porque la fecha cambia de un mes a otro y entre promos: no hay regla de la que derivarla. El monto se sigue calculando.
- **`PromocionUso`**: consumo cargado a mano (`fecha` string, `mes`/`anio` derivados, `montoGasto`). `onDelete: Cascade` desde la promo. El ciclo al que cuenta sale de la `fecha` (no del `mes`).
- **`PromocionSaldoUso`**: **uso del saldo a favor** (`fecha`, `monto`, `notas?`; cascade desde la promo) — "de lo que me reintegraron, gasté $X".

Migraciones: `20261028100000_add_promociones/`, `20261029100000_promocion_gasto_vigencia/` y `20261030100000_promocion_varios_conceptos/` y `20261031100000_promocion_reintegro_vencimiento/` y `20261104100000_promocion_categorias_etiquetas/` y `20261119120000_promocion_modalidad/` (columna `modalidad`, default `virtual`: las promos existentes pasan a virtual) y `20261119180000_promocion_reinicio_saldo/` (`Promocion.diaReinicio` default 1 — las existentes siguen en mes calendario —, `Gasto.promocionFecha` nullable y la tabla `PromocionSaldoUso`) (aditivas; la de categorías/etiquetas sólo crea las dos tablas puente). La última crea la tabla puente, copia el `conceptoId` que ya tenía cada promo y suelta su FK; la columna `Promocion.conceptoId` queda como **legacy** (la app no la lee ni la escribe) para no romper el código que corre en producción contra la misma base.

Decisiones:

- **Es una regla recurrente, no hay una fila por mes.** Lo que cambia por período (consumo, reintegro, lo que falta) **se calcula**, no se persiste.
- **La asociación gasto → promo es explícita, no por concepto.** El gasto no guarda fecha de compra en general (sólo `mes`/`anio` y vencimiento; la `promocionFecha` existe sólo en los asociados y sólo decide el ciclo), así que no se puede saber qué gastos del mes caen después de que la promo arrancó. Antes se sumaban todos los del concepto, y una promo que empieza a mitad de mes contaba compras anteriores. Ahora cuenta sólo lo asociado; los **criterios vinculados** —conceptos, categorías y etiquetas, todos opcionales y de a varios— quedaron como **pista** para sugerir y listar candidatos.
- **Criterios = OR** (`criterioCoincide`): un gasto coincide si su concepto, su categoría o **alguna** de sus etiquetas está entre los vinculados. Vincular una categoría **amplía** la promo, no la restringe (no es "concepto Y categoría"). Una promo sin ningún criterio no se sugiere ni lista candidatos (`tieneCriterios`); sólo suma lo asociado a mano y los usos manuales. La categoría/etiquetas que se miran son las del **gasto**, no las de sus sub-ítems.
- **`efectivo`** = gasto de **débito sin tarjeta** (`tipoPago === 'D'` y `tarjetaId == null`). Un débito con una tarjeta que no es de la promo no cuenta como efectivo (`medioCoincide`).
- **Tope obligatorio (`> 0`)** en porcentaje: el gasto mínimo para el tope divide por el porcentaje. En **monto fijo** es opcional en el body/form: sin tope se guarda `topeMensual = montoReintegro` (un solo reintegro por ciclo), así la columna sigue siendo obligatoria y todo el cálculo del tope (disponible, totales, saldo) no cambia.
- **Vigencia** (`vigenteEnCiclo`): se evalúa **por ciclo** (la promo vale en un ciclo si se superpone con él; con reinicio el 1, el mes calendario). Fuera de vigencia no se sugiere, no entra en la semana/Hoy ni en los totales, y la card sale atenuada con "Fuera de vigencia". **No filtra gastos** (no hay fecha de compra): sólo evita sugerir/contar fuera del rango. Una promo que arranca el 15/10 sí vale en octubre; los gastos de octubre anteriores al 15 se excluyen **no asociándolos**.
- Mergear conceptos, categorías o etiquetas (`/api/{conceptos,categorias,etiquetas}/merge`) **conecta el destino** a las promos que tenían el origen (idempotente si ya tenían los dos); si no, al borrar el origen la tabla puente lo soltaría y la promo dejaría de sugerirse en silencio. Borrar una categoría/etiqueta (sólo posible sin uso en gastos) la suelta de las promos por cascade.
- **Copiar mes no hereda la promo** (`/api/gastos/copiar` arma los campos a mano y no copia `promocionId`): el gasto del mes nuevo podría caer antes del inicio de la promo; se vuelve a sugerir al editarlo. La **propina** (segundo gasto del alta) tampoco la hereda (`buildPropinaGasto`).

## Cómo se calcula (`src/lib/promociones-compute.ts`, puro)

### Tipos de reintegro

- **`porcentaje`** (todas las promos anteriores): un % de lo gastado en el ciclo, hasta el tope.
- **`monto_fijo`**: "$5.000 de reintegro en compras desde $20.000". Cada compra (gasto asociado o uso manual) que llega a la `compraMinima` (inclusive; `null` = cualquier compra positiva) devuelve `montoReintegro`, hasta el tope. **El mínimo es por compra, no acumulado**: dos compras de $15.000 no dan nada aunque sumen $30.000. Comprar más caro no devuelve más.
- `reintegroDeCompra(regla, monto)` es el reintegro **sin topear** de una compra (lineal en porcentaje). Lo usan `progresoPromocion` y, en el cliente, `AsociarGastosDialog` y `UsoPromoDialog` (con `reglaDeRespuesta`, que pasa la respuesta snake_case a la regla).
- `textoReintegro` ("20%" / "$ 5.000 desde $ 20.000") y `textoFaltaTope` ("gastando $X más" / "con N compras más de al menos $Y") son los textos que muestran la card, la semana, Hoy, el popup de `/gastos` y el select de promo del form de gasto.

### Ciclo del tope (día de reinicio)

El tope se reinicia el `diaReinicio` de cada mes (casi siempre el 1). El **ciclo `(mes, anio)`** va del día de reinicio de ese mes al día anterior al reinicio del siguiente (`rangoCiclo`): con reinicio el 5, el ciclo de noviembre es 05/11 → 04/12; un reinicio que no existe en el mes (31 en febrero) se recorta al último día. El ciclo se nombra por el mes en que **empieza**: el 03/12 todavía es el ciclo de noviembre (`cicloDeFecha`).

- Un gasto asociado cuenta en el ciclo de su `promocionFecha` o, sin ella, en el que empieza en su `mes` (`cicloDeGasto`). Un uso manual, en el de su `fecha`.
- Al llegar el reinicio, **lo que no se usó del tope se pierde** (el ciclo nuevo arranca con el 100% disponible); **lo ya reintegrado no**: pasa al saldo (abajo).
- Con reinicio el 1 todo se comporta exactamente como antes (ciclo = mes calendario).

Consumo del ciclo (`consumoEnCiclo`) = **automático + manual**:

- **Automático** (`consumoAutomatico(promoId, gastos)` sobre los gastos del ciclo): suma `totalMoneda × tipoCambio` de los gastos con `promocionId` = la promo; las devoluciones (negativos) restan.
- **Manual**: los `PromocionUso` del ciclo, para lo que no está cargado como gasto.
- **`compras`**: el monto de cada gasto (en ARS) y de cada uso por separado. Sólo lo usa el monto fijo, que mira compra por compra y no se puede reconstruir desde las sumas.

`progresoPromocion(promo, auto, manual, compras)` — en **porcentaje**:

| Campo | Fórmula |
|---|---|
| `reintegrado` | `min(consumo × %, tope)` (consumo negativo = 0) |
| `gasto_minimo` | `tope ÷ %` — el gasto que agota justo el tope; menos deja plata sobre la mesa, más no suma |
| `gasto_restante` | `max(0, gasto_minimo − consumo)` |
| `disponible` | `tope − reintegrado` (lo que queda por ganar) |
| `estado` | `sin_uso` / `en_curso` / `tope_alcanzado` |

En **monto fijo** (`progresoMontoFijo`): `compras_validas` = las compras que llegan a la mínima; `reintegrado = min(compras_validas × monto, tope)`; compras necesarias = `ceil(tope ÷ monto)` (un tope que no es múltiplo del monto pide una compra más, que se topea); `gasto_minimo = necesarias × mínima`; `compras_restantes` = las que faltan y `gasto_restante = compras_restantes × mínima`. `estado` es `en_curso` recién con una compra válida. En porcentaje `compras_validas`/`compras_restantes` son `null`.

Los días sólo alimentan el calendario: no se verifican contra los gastos. Doble conteo: un consumo cargado como gasto asociado **y** como uso manual suma dos veces; los usos manuales son para lo que no está en gastos.

### Saldo a favor (`lotesPromocion` + `saldoPromocion`)

Lo reintegrado es plata a favor que se va **acumulando** entre ciclos hasta que se usa o vence:

- Cada ciclo con reintegro > 0 es un **lote** (`lotesPromocion`): `monto` = reintegrado topeado de ese ciclo, con el `vence_el`/`utilizado` cargados en `PromocionReintegro` para ese ciclo y `desde` = inicio del ciclo.
- Los **usos del saldo** (`PromocionSaldoUso`) se aplican en orden de fecha; cada uno se descuenta de los lotes que **ya existían** (`desde ≤ fecha`) y **no habían vencido** a esa fecha, **primero los que vencen antes** (FIFO por vencimiento; sin vencimiento al final, desempate por ciclo). Así un uso consume la plata que se iba a perder antes. Lo que un uso no pudo descontar queda en `sin_respaldo` (se informa, no resta).
- "Ya lo usé" (`utilizado`) consume el lote entero.
- Al día `hoy`, lo que quede de un lote con `vence_el < hoy` se **perdió** (`vencido`) y no suma; el día del vencimiento todavía se puede usar.
- `disponible` = lo que queda de los lotes vivos: recuperé 5.000 y usé 2.000 → 3.000; lo que se reintegre en el ciclo nuevo se suma encima. También `reintegrado` (histórico), `usado`, `proximo_vencimiento` (`{ vence_el, monto }` del más cercano) y `lotes` (con `usado`/`restante`/`estado`).
- El saldo es de **todas** las promos, también inactivas o fuera de vigencia (lo reintegrado no se pierde porque la promo terminó). Nada se persiste: se recalcula con el histórico completo en cada GET.

### Cómo se asocia un gasto

1. **Al cargarlo** (`GastoForm` → `PromocionGastoField`): consulta `GET /api/promociones/sugeridas` (concepto/categoría/etiquetas del gasto + medio de pago + vigente en el ciclo de la fecha de compra; se vuelve a consultar al cambiar cualquiera de ellos). Con una promo elegida aparece al lado **"Fecha de compra"** (`promocion_fecha`; en el alta, hoy en fecha local; editando, la guardada): decide el día de la semana y a qué ciclo cuenta. Vacía = el ciclo del mes del gasto, sin filtro por día. En el **alta**, la promo coincidente con tope disponible queda **elegida de entrada**; quien carga puede pasarla a "Sin promoción" (p. ej. una compra anterior al inicio). Editando no se cambia nada solo, y la promo ya asociada siempre se ofrece (`promocion_id` fuerza incluirla, con `coincide: false`). El campo no aparece si no hay promo para ofrecer, ni en un resumen de tarjeta. `GastoFormData.promocion_id` viaja al POST/PUT de gastos (el PUT sólo lo toca si la clave viene en el body).
2. **A posteriori** (`AsociarGastosDialog`, botón "Gastos que cuentan" en la card, sólo con algún criterio vinculado): lista los gastos del mes que coinciden con **cualquiera de los criterios** (pre-filtro en la DB con `whereGastoCriterios`) con medio válido **y fecha dentro de la vigencia de la promo** (`fechaEnVigencia`, sobre `promocionFecha ?? fechaVencimiento`; sin fecha no se descarta) —más los ya asociados, aunque estén fuera— con un check cada uno, y sincroniza con `POST /api/promociones/[id]/asociar`. Es la forma de arreglar el primer mes o gastos cargados antes de la promo.

### Vencimiento del reintegro

Para no perder un reintegro por no usarlo a tiempo, cada reintegro puede llevar su fecha de vencimiento:

- **Card de la promo** (`PromoCard`): bajo los datos, "Vencimiento del reintegro:" con un chip `dd/mm · vence en N días` (`VencimientoChip`) o "Cargar fecha" si no hay; "Ya lo usé" si se marcó como utilizado. Click abre `VencimientoReintegroDialog` (fecha + "Ya lo usé" + "Quitar vencimiento"). Es del **ciclo que muestra la card** (`promo.ciclo`). La fila sólo aparece si ya hay algo reintegrado o cargado. Debajo, el bloque **"Saldo a favor"**: disponible, lo que vence primero, "Usé saldo" (`SaldoUsoDialog`: fecha, monto —prellenado con todo el saldo—, nota; avisa cuánto queda o si se pasa), el resumen reintegrado/usado/vencido y la lista colapsable de usos del saldo con borrar.
- **Panel "Saldo de reintegros para usar"** (`SaldosReintegros`, arriba de todo): las promos con saldo > 0, la que vence antes primero (`ordenarPorVencimiento`), con su saldo, "Usé saldo" y, por cada ciclo con algo sin usar, `$X de <mes>` (+ cuánto se usó) con su chip de vencimiento o "Cargar vencimiento". El borde toma el color del más urgente. No depende del mes que se mira; no se muestra si no hay saldo.
- **Color** (`estadoVencimiento(venceEl, hoy)`): `vencido` y `urgente` (≤ 7 días, incluye hoy) en rojo, `proximo` (≤ 15) en naranja, `ok` neutro. Los días se cuentan en UTC sobre el string (`diasHasta`) y `hoy` es la fecha local del cliente.
- Lo vencido ya no se lista (se perdió): queda sólo como "vencido sin usar" en la card. Si se usó antes de vencer y no se registró, cargar el uso del saldo **con su fecha** lo descuenta retroactivamente de ese lote.

### Popup en `/gastos` (`PromocionesHoyAlert`)

Al entrar a la pantalla principal de gastos sale un popup "Promociones" con:

- **Vigentes hoy**: las promos activas, vigentes en el mes y que valen el día de la semana de hoy, **con tope por aprovechar** (las de tope agotado no interrumpen), ordenadas por disponible, con "Podés recuperar $X · gastando $Y más".
- **Saldo de reintegros para usar**: las promos con saldo a favor > 0 (con o sin vencimiento cargado), la que vence antes primero, con el chip del próximo vencimiento y el total.

La selección la hace `avisoPromociones(promos, reintegros, hoy)` (pura, en `promociones-compute.ts`); si no hay ninguna de las dos cosas no abre. Mira siempre el **mes de hoy** (`GET /api/promociones?mes=&anio=` con la fecha local + `GET /api/promociones/vencimientos`), no el período elegido en el dashboard. Sale **cada vez que se entra** a `/gastos` (se monta en cada navegación, sin `localStorage` ni descarte persistente; cerrarlo sólo lo oculta hasta la próxima entrada). Para no apilar dos diálogos, espera a que se cierre `VencimientosHoyAlert` (prop `onDone`, que también se llama si no había vencimientos o falló el fetch).

## API

| Ruta | Qué hace |
|---|---|
| `GET /api/promociones?mes=&anio=[&hoy=][&actual=1]` | Promos con `ciclo` (`{ mes, anio, desde, hasta }`: el que empieza en el mes, o con `actual=1` el **en curso** a `hoy` según el `dia_reinicio` de cada una), `vigente` (en el ciclo), `reintegro` (vencimiento cargado del ciclo o `null`), `usos` del ciclo, `progreso`, **`saldo`** (a `hoy`; sin `hoy`, la fecha de Argentina) y `saldo_usos`, más `totales` (sólo activas y vigentes, salvo `saldo` que es de todas). Una query por tabla con el histórico completo de todas las promos (`promocionesConProgreso` con `saldoAl`). |
| `POST /api/promociones` | Alta (`parsePromocionBody`; `tipo` (`porcentaje` default o `monto_fijo`), en monto fijo `monto_reintegro > 0`, `compra_minima` opcional y `tope_mensual` opcional; `concepto_ids`/`categoria_ids`/`etiqueta_ids: number[]` opcionales; 400 si algún concepto, categoría, etiqueta o tarjeta no existe, o la vigencia es inválida). La respuesta trae `*_ids` y `*_nombres` de los tres ejes. |
| `PUT/DELETE /api/promociones/[id]` | Edita (tarjetas, conceptos, categorías y etiquetas se **reemplazan** con `set`) / borra (cascade a los usos; los gastos quedan sin promo). |
| `GET /api/promociones/sugeridas` | Para el form de gasto: promos activas que coinciden con el concepto (`descripcion`), la categoría (`categoria_id`) **o** alguna etiqueta (`etiqueta_ids`, separadas por coma) del gasto, medio (`tipo_pago`, `tarjeta_id`), vigentes en el ciclo de `fecha` (la **fecha de compra** que manda el form; sin ella, el ciclo de `mes`/`anio`) y **que valen el día de la semana de `fecha`** (una promo de martes no se ofrece un sábado; sin `fecha` no filtra por día; la promo ya asociada se sigue mostrando con `coincide: false`), con `disponible`/`tope_alcanzado` de ese ciclo y la regla (`tipo`, `porcentaje`, `monto_reintegro`, `compra_minima`) para rotular la opción. Sin saldo: sólo trae los gastos/usos del rango de los ciclos. |
| `GET /api/promociones/[id]/candidatos?mes=&anio=` | Gastos del mes que podrían contar (coinciden con cualquiera de los criterios vinculados + medio válido + fecha dentro de la vigencia, más los ya asociados); 400 sin ningún criterio vinculado. |
| `POST /api/promociones/[id]/asociar` | `{ gasto_ids, asociar }`: asocia (pisa la anterior) o desasocia (sólo los de esta promo). |
| `PUT /api/promociones/[id]/reintegro` | `{ mes, anio, vence_el, utilizado }`: carga/cambia el vencimiento de lo reintegrado en el ciclo (upsert por promo+mes+año). Sin fecha y sin `utilizado` **borra** la fila y devuelve `null`. |
| `POST /api/promociones/[id]/saldo-usos` | Uso del saldo a favor `{ fecha, monto, notas? }` (`parseSaldoUsoBody`: fecha válida, monto `> 0`). No valida contra el saldo: el exceso sale como `sin_respaldo`. |
| `DELETE /api/promociones/[id]/saldo-usos/[usoId]` | Quita un uso del saldo (busca por ambos ids). |

`GET /api/promociones/vencimientos` se eliminó: su panel lo reemplaza el saldo que viaja en `GET /api/promociones`.
| `POST /api/promociones/[id]/usos` | Registra un uso manual `{ fecha, monto_gasto, notas? }`. |
| `DELETE /api/promociones/[id]/usos/[usoId]` | Quita un uso (busca por ambos ids). |

## UI (`src/app/promociones/page.tsx`, `src/components/promociones/`)

De arriba hacia abajo: período (compartido con `/gastos` vía el store) → panel de **saldo** (`SaldosReintegros`) → 4 KPIs (reintegrado / por reintegrar / saldo a favor / tope total) → **Hoy** (sólo en el mes actual: las promos del día, ordenadas por plata disponible, con "gastando $X más") → **Semana** (`SemanaPromos`: 7 columnas Lun–Dom con chips de lugar + % + logos de tarjeta/efectivo + lo que queda; hoy resaltado; en móvil pasa a lista vertical) → **Progreso del mes** (`PromoCard`: barra del tope, gastado / gasto mínimo / reintegrado / por reintegrar, "te faltan gastar $X", chip de vigencia, chip **"Ciclo dd/mm → dd/mm"** si se reinicia otro día que el 1, saldo a favor, usos manuales colapsables). Click en un chip de la semana abre la edición.

**Qué ciclo se mira:** en el **mes actual** la página pide `actual=1` — cada promo muestra su ciclo **en curso** hoy (con reinicio el 5, el 03/12 todavía muestra noviembre); en otro mes, el ciclo que **empieza** en ese mes. El popup de `/gastos` también usa `actual=1`.

`PromocionDialog` tiene **"El tope se reinicia el día"** (1–31, default 1), visible sólo si la vigencia abarca más de un mes calendario (o no tiene fin); si no, se manda 1.

Arriba de las secciones hay un **filtro Todas / Presencial / Virtual** (`coincideModalidad`; las `ambas` aparecen en los dos; los KPIs se recalculan sobre lo filtrado; es estado de la página, no se persiste). `PromocionDialog` tiene un selector **Modalidad** (Presencial / Virtual / Ambas); `MediosPromo` (card, semana y popup) la muestra con un icono de local y/o de web junto a los medios de pago. Cada tarjeta se dibuja con el componente compartido `TarjetaConMarca`: logo del banco (si hay o se infiere) con el **logo de la marca chiquito en la esquina superior derecha** (no se dibuja con marca `otra` o vacía), para distinguir dos tarjetas del mismo banco; tooltip "Banco (Marca)" (`tarjetaTitulo`). Sin logo de banco, la marca a tamaño completo. La marca es siempre `MarcaLogo` — ver `docs/claude/tarjetas.md` → Logos de marca. `PromocionDialog` (con vigencia desde/hasta opcionales) ofrece las tarjetas con `tarjetasVisiblesEn` (no las dadas de baja, salvo las ya elegidas), con el mismo formato que el select de tarjeta de `GastoForm` (`TarjetaConMarca` + "Banco (Marca)", ordenadas por ese texto). Es **un solo multi-select de medios de pago**: "Débito / Efectivo" va primero (valor centinela `efectivo`, que se guarda en `Promocion.efectivo`) y se puede combinar con cualquier cantidad de tarjetas — una promo que vale con varias tarjetas y/o efectivo es una sola. Debajo, tres multi-selects opcionales de **conceptos, categorías y etiquetas vinculados** (alcanza con que el gasto coincida con uno). `UsoPromoDialog` registra un uso con el reintegro estimado (en monto fijo avisa si el uso no llega a la mínima).

`PromocionDialog` tiene un selector **Tipo de reintegro** (Porcentaje / Monto fijo). En monto fijo pide **reintegro por compra**, **compra mínima** y **tope por mes (opcional)**, y muestra cuántas compras hacen falta para el tope. La card muestra "Para el reintegro máximo, con N compras más de al menos $Y" y `AsociarGastosDialog` marca los gastos que **no llegan a la compra mínima** (y no los suma al reintegro estimado).

## Tests

`promociones-compute.test.ts` (puro: monto fijo —parse, reintegro por compra, progreso compra por compra, lotes, textos—, ciclo/reinicio, `promocionFechaDeBody`, consumo por ciclo, lotes y saldo FIFO con vencimientos) y `api/promociones/route.test.ts` (histórico, saldo, `actual=1`), `[id]/route.test.ts`, `[id]/usos/route.test.ts`, `[id]/saldo-usos/route.test.ts`, `sugeridas/route.test.ts` (ciclo por fecha de compra), `[id]/candidatos/route.test.ts`, `[id]/asociar/route.test.ts`, `[id]/reintegro/route.test.ts`; `gastos/route.test.ts` y `gastos/[id]/route.test.ts` cubren `promocion_id` y `promocion_fecha`, `propina.test.ts` que la propina no la hereda, y `{conceptos,categorias,etiquetas}/merge/route.test.ts` que la promo siga al destino.
