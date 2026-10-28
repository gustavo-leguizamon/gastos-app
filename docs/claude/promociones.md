# Promociones (reintegros mensuales)

Sección `/promociones` (desde `TopBar`, icono `LocalOfferIcon`). Responde: **"¿dónde me conviene gastar hoy, cuánto tengo que gastar para exprimir cada tope y cuánto llevo reintegrado?"**

## Modelo (`prisma/schema.prisma`)

- **`Promocion`**: `lugar`, `porcentaje`, `topeMensual` (reintegro máximo por mes, en ARS), `dias Int[]` (**0 = lunes … 6 = domingo**), `tarjetas` (M2M implícita `_PromocionTarjetas` con `Tarjeta`), `efectivo`, `activa`, `notas`, `conceptos` (M2M implícita `_PromocionConceptos` con `Concepto`: **varios** conceptos por promo), `vigenteDesde?`/`vigenteHasta?` (YYYY-MM-DD inclusive; `null` = sin límite de ese lado).
- **`Gasto.promocionId?`** (FK `SetNull`, indexada): la promo a la que **cuenta** ese gasto. Es la fuente del consumo automático.
- **`PromocionUso`**: consumo cargado a mano (`fecha` string, `mes`/`anio` derivados, `montoGasto`). `onDelete: Cascade` desde la promo.

Migraciones: `20261028100000_add_promociones/`, `20261029100000_promocion_gasto_vigencia/` y `20261030100000_promocion_varios_conceptos/` (aditivas). La última crea la tabla puente, copia el `conceptoId` que ya tenía cada promo y suelta su FK; la columna `Promocion.conceptoId` queda como **legacy** (la app no la lee ni la escribe) para no romper el código que corre en producción contra la misma base.

Decisiones:

- **Es una regla recurrente, no hay una fila por mes.** Lo que cambia por período (consumo, reintegro, lo que falta) **se calcula**, no se persiste.
- **La asociación gasto → promo es explícita, no por concepto.** El gasto no guarda fecha de compra (sólo `mes`/`anio` y vencimiento), así que no se puede saber qué gastos del mes caen después de que la promo arrancó. Antes se sumaban todos los del concepto, y una promo que empieza a mitad de mes contaba compras anteriores. Ahora cuenta sólo lo asociado; los conceptos vinculados (uno o varios) quedaron como **pista** para sugerir y listar candidatos: un gasto de **cualquiera** de ellos dispara la sugerencia.
- **`efectivo`** = gasto de **débito sin tarjeta** (`tipoPago === 'D'` y `tarjetaId == null`). Un débito con una tarjeta que no es de la promo no cuenta como efectivo (`medioCoincide`).
- **Tope obligatorio (`> 0`)**: el gasto mínimo para el tope divide por el porcentaje.
- **Vigencia** (`vigenteEnMes`): se evalúa **por mes** (la promo vale en un mes si se superpone con él). Fuera de vigencia no se sugiere, no entra en la semana/Hoy ni en los totales, y la card sale atenuada con "Fuera de vigencia". **No filtra gastos** (no hay fecha de compra): sólo evita sugerir/contar fuera del rango. Una promo que arranca el 15/10 sí vale en octubre; los gastos de octubre anteriores al 15 se excluyen **no asociándolos**.
- Mergear conceptos (`/api/conceptos/merge`) **conecta el destino** a las promos que tenían el origen (idempotente si ya tenían los dos); si no, al borrar el origen la tabla puente lo soltaría y la promo dejaría de sugerirse en silencio.
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

1. **Al cargarlo** (`GastoForm` → `PromocionGastoField`): consulta `GET /api/promociones/sugeridas` (concepto + medio de pago + vigente en el mes del gasto). En el **alta**, la promo coincidente con tope disponible queda **elegida de entrada**; quien carga puede pasarla a "Sin promoción" (p. ej. una compra anterior al inicio). Editando no se cambia nada solo, y la promo ya asociada siempre se ofrece (`promocion_id` fuerza incluirla, con `coincide: false`). El campo no aparece si no hay promo para ofrecer, ni en un resumen de tarjeta. `GastoFormData.promocion_id` viaja al POST/PUT de gastos (el PUT sólo lo toca si la clave viene en el body).
2. **A posteriori** (`AsociarGastosDialog`, botón "Gastos que cuentan" en la card, sólo con conceptos vinculados): lista los gastos del mes de **cualquiera de los conceptos** con medio válido (más los ya asociados) con un check cada uno, y sincroniza con `POST /api/promociones/[id]/asociar`. Es la forma de arreglar el primer mes o gastos cargados antes de la promo.

## API

| Ruta | Qué hace |
|---|---|
| `GET /api/promociones?mes=&anio=` | Promos con `vigente` (en el período), `usos` del período y `progreso`, más `totales` (sólo activas y vigentes). Una sola query de gastos asociados (`promocionesConProgreso`). |
| `POST /api/promociones` | Alta (`parsePromocionBody`; 400 si algún concepto o alguna tarjeta no existen; `concepto_ids: number[]`, o la vigencia es inválida). |
| `PUT/DELETE /api/promociones/[id]` | Edita (tarjetas y conceptos se **reemplazan** con `set`) / borra (cascade a los usos; los gastos quedan sin promo). |
| `GET /api/promociones/sugeridas` | Para el form de gasto: promos activas que tienen el concepto del gasto (`descripcion`) entre los suyos, medio (`tipo_pago`, `tarjeta_id`) y vigentes en `mes`/`anio`, con `disponible`/`tope_alcanzado`. |
| `GET /api/promociones/[id]/candidatos?mes=&anio=` | Gastos del mes que podrían contar (de cualquiera de los conceptos vinculados + medio válido, más los ya asociados); 400 sin conceptos vinculados. |
| `POST /api/promociones/[id]/asociar` | `{ gasto_ids, asociar }`: asocia (pisa la anterior) o desasocia (sólo los de esta promo). |
| `POST /api/promociones/[id]/usos` | Registra un uso manual `{ fecha, monto_gasto, notas? }`. |
| `DELETE /api/promociones/[id]/usos/[usoId]` | Quita un uso (busca por ambos ids). |

## UI (`src/app/promociones/page.tsx`, `src/components/promociones/`)

De arriba hacia abajo: período (compartido con `/gastos` vía el store) → 3 KPIs (reintegrado / por reintegrar / tope total) → **Hoy** (sólo en el mes actual: las promos del día, ordenadas por plata disponible, con "gastando $X más") → **Semana** (`SemanaPromos`: 7 columnas Lun–Dom con chips de lugar + % + logos de tarjeta/efectivo + lo que queda; hoy resaltado; en móvil pasa a lista vertical) → **Progreso del mes** (`PromoCard`: barra del tope, gastado / gasto mínimo / reintegrado / por reintegrar, "te faltan gastar $X", chip de vigencia, usos manuales colapsables). Click en un chip de la semana abre la edición.

`PromocionDialog` (con vigencia desde/hasta opcionales) ofrece las tarjetas con `tarjetasVisiblesEn` (no las dadas de baja, salvo las ya elegidas), con el mismo formato que el select de tarjeta de `GastoForm` (`BrandLogo` + "Nombre (Banco)"). Es **un solo multi-select de medios de pago**: "Débito / Efectivo" va primero (valor centinela `efectivo`, que se guarda en `Promocion.efectivo`) y se puede combinar con cualquier cantidad de tarjetas — una promo que vale con varias tarjetas y/o efectivo es una sola. `UsoPromoDialog` registra un uso con el reintegro estimado.

## Tests

`promociones-compute.test.ts` (puro) y `api/promociones/route.test.ts`, `[id]/route.test.ts`, `[id]/usos/route.test.ts`, `sugeridas/route.test.ts`, `[id]/candidatos/route.test.ts`, `[id]/asociar/route.test.ts`; `gastos/route.test.ts` y `gastos/[id]/route.test.ts` cubren `promocion_id`, `propina.test.ts` que la propina no la hereda, y `conceptos/merge/route.test.ts` que la promo siga al concepto destino.
