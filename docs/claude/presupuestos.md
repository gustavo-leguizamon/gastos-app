# Presupuestos (topes mensuales por categoría)

Sección `/presupuestos` (desde `TopBar`, icono `SavingsIcon`). Responde la pregunta que la
app no podía responder: **"¿me pasé en Comida este mes?"**. Antes había montos absolutos en
todos lados pero nada contra qué compararlos.

## Modelo (`prisma/schema.prisma`)

```prisma
model Presupuesto {
  id          Int      @id @default(autoincrement())
  categoriaId Int
  mes         Int
  anio        Int
  monto       Float
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  categoria Categoria @relation(fields: [categoriaId], references: [id], onDelete: Cascade)

  @@unique([categoriaId, mes, anio])
  @@index([anio, mes])
}
```

Migración: `20260820110000_add_presupuesto/`.

Tres decisiones del modelo:

- **Por `(categoría, mes, año)`, no un default que se arrastra.** Cambiar el tope de un mes
  no debe reescribir la historia de los meses ya cerrados.
- **La ausencia de fila significa "sin presupuesto"**, que **no** es lo mismo que un tope en
  `0`. Un 0 dice "acá no se gasta nada" y cualquier gasto lo excede; sin fila la categoría
  simplemente no se compara contra nada. Por eso "quitar" borra la fila en vez de ponerla en
  cero, y el `DELETE` lo documenta explícitamente.
- **`onDelete: Cascade`** desde la categoría: un presupuesto de una categoría borrada no
  significa nada.

`Presupuesto.fijado` (`Boolean @default(false)`) marca el tope que **el reparto automático no
toca**. Cubre los dos casos que el algoritmo trata igual: la categoría marcada como gasto fijo
(no ajustable) y la que se ajustó a mano después de generar. Se persiste para poder prefillear
las fijas del mes siguiente.

```prisma
model ObjetivoAhorro {
  id                Int      @id @default(autoincrement())
  mes               Int
  anio              Int
  monto             Float
  ingresosEsperados Float
  base              String   @default("devengado")
  mesesHistorico    Int      @default(3)
  @@unique([mes, anio])
}
```

Migración: `20260829100000_add_objetivo_ahorro/` (crea la tabla y agrega `Presupuesto.fijado`).

El objetivo guarda **los supuestos con los que se generó**, no sólo el monto: sin los ingresos
esperados, la base y la ventana de histórico no se puede recalcular después ni explicar de
dónde salió cada tope. Los ingresos esperados **no son derivables** de `Ingreso`: al
presupuestar un mes que todavía no arrancó no hay ninguno cargado.

## Qué se cuenta como "gastado": las dos bases (IMPORTANTE)

La app tenía **dos definiciones de "lo gastado"** que no eran comparables y vivían en
pantallas distintas:

- El **ahorro del mes** (`computeAhorro`, ver `docs/claude/ingresos.md`) se mide contra
  `total_debito`, que sólo cuenta `tipoPago === 'D'` — la plata que sale de la cuenta.
- El **presupuesto por categoría** se medía contra `computeReportes` con `esTarjeta: false`
  — débito más cada consumo de crédito individual.

Mezclarlas rompe cualquier objetivo de ahorro repartido en topes por categoría: se pueden
cumplir todos los topes y que el ahorro medido no dé, o al revés. En vez de elegir una y
esconder la otra, **las dos se calculan y se muestran lado a lado**. Viven juntas en
`src/lib/presupuestos-base.ts` (`BasePresupuesto = 'devengado' | 'caja'`), que es lo que
impide que las pantallas se contradigan: quien necesite "lo gastado por categoría" pasa por
ahí y dice cuál quiere.

| Base | Qué gastos entran | A qué nivel se atribuye | Responde |
|---|---|---|---|
| `devengado` | Todo menos los resúmenes de tarjeta (`!esTarjeta`) | Nivel gasto (`computeReportes`) | "¿cuánto consumí?" |
| `caja` | Los `tipoPago === 'D'`, **incluyendo los resúmenes** | Por sub-ítem (`computeReporteSubitems`) | "¿cuánta plata salió de la cuenta?" |

Dos decisiones que sostienen la tabla:

- **El resumen de tarjeta entra en caja porque se crea con `tipoPago: 'D'`**
  (`gastos/[id]/pagos/route.ts`): pagar la tarjeta es una salida de la cuenta. Es el mismo
  conjunto que suma `total_debito` en el resumen, así que la base caja no puede contradecir
  el KPI de ahorro del dashboard.
- **Caja agrega por sub-ítem, no por gasto.** Sin eso el pago del resumen caería entero en la
  categoría del contenedor ("Tarjeta crédito") y el presupuesto por categoría en caja no
  diría nada. Los sub-ítems del resumen llevan la `categoriaId` heredada del gasto que los
  originó, así que el pago se reparte en las categorías de sus consumos. Los gastos de débito
  sin sub-ítems caen a su propia categoría (fallback de `gastosToSubitemUnits`).

Devengado sigue siendo exactamente la métrica del reporte por categoría, así que el panel y
el reporte tampoco pueden contradecirse.

### `no_atribuido` (por qué se informa en vez de repartirse)

`gastadoPorCategoria` devuelve además `no_atribuido`: el total real de los gastos que
participan menos lo atribuido a categorías. En devengado es **siempre 0** (cada gasto aporta
su total entero). En caja puede no serlo: el desglose usa el monto de cada sub-ítem tal cual,
así que si un resumen tiene sub-ítems que no cierran contra su total, esa diferencia no cae
en ninguna categoría. Se expone (la pantalla muestra un alert) en vez de prorratearse: es un
error de carga del dato, y repartirlo en silencio daría una comparación falsa y un
presupuesto mal armado.

Las diferencias menores a **`UMBRAL_NO_ATRIBUIDO` = 1 peso se reportan como 0**. Un resumen con
decenas de sub-ítems arrastra centavos de redondeo (los montos se cargan ya redondeados y su
suma no da exactamente el total), y sin ese piso 13 centavos de deriva sobre millones aparecían
como un problema. Un ítem que falta de verdad es de otro orden de magnitud.

**Ojo con leer la categoría "Tarjeta crédito" en caja:** ahí **no** está el pago del resumen —
ese se reparte en las categorías de sus consumos. Sólo caen los sub-ítems que tengan esa
categoría propia (intereses, sellados, comisiones) y los resúmenes sin sub-ítems. Al revés, en
devengado esos intereses son **invisibles**: viven dentro de un resumen, y devengado excluye los
resúmenes.

## Lógica pura (`src/lib/presupuestos-base.ts`)

Sin imports de Prisma/Next. Test: `presupuestos-base.test.ts`.

| Función | Qué hace |
|---|---|
| `gastosDeBase(gastos, base)` | El subconjunto de gastos del mes que participa de cada base (ver tabla de arriba). |
| `gastadoPorCategoria(gastos, base, months)` | Lo gastado por categoría según la base: `{ base, por_categoria, total, no_atribuido }`. |

## Lógica pura (`src/lib/presupuestos-compute.ts`)

Sin imports de Prisma/Next. Test: `presupuestos-compute.test.ts`.

| Función | Qué hace |
|---|---|
| `parsePresupuestoBody(body)` | Valida/normaliza el body a camelCase. Acepta `monto = 0`, **rechaza negativos** (un tope negativo no representa nada). `null` → la route responde 400 sin tocar la DB. |
| `toPresupuestoResponse(row)` | Mapping camelCase→snake_case, con `categoria_nombre` del include. |
| `computeEjecucion(presupuestos, gastosPorCategoria)` | Cruza tope contra gasto. Una fila **por cada categoría con tope o con gasto**. |
| `totalesPresupuesto(filas)` | KPIs de la pantalla. |

### Estados

`UMBRAL_CERCA = 90`:

- `excedido` — consumido **> 100%**. Con tope en `0`, cualquier gasto > 0 lo excede.
- `cerca` — entre 90% y 100% inclusive.
- `ok` — el resto. Un tope en 0 **sin** gasto sigue siendo `ok`.

`consumido_pct` es `null` cuando el tope es 0 (no se divide por cero); el estado ya comunica
el exceso.

### Dos decisiones del cálculo

- **Las categorías con gasto pero sin tope se listan igual** (`monto: null`). Esconderlas
  daría la impresión de que todo el gasto del mes está presupuestado cuando no lo está. La
  fila `id: null` ("Sin categoría") sí se ignora: no es una categoría a la que ponerle tope.
- **El `gastado` de los totales cuenta sólo las categorías con tope.** Sumarle lo no
  presupuestado haría que el total se pase del presupuesto aunque cada categoría esté dentro
  del suyo. Lo no presupuestado se informa aparte, en `sin_presupuesto`.

**Orden de las filas:** excedidos → cerca → resto; dentro de cada grupo, mayor consumo
primero. Lo que requiere atención queda arriba.

## Generación automática desde un objetivo de ahorro

Responde la pregunta que los topes sueltos no respondían: *"quiero que este mes me sobren $X —
¿cuánto puedo gastar en cada categoría?"*. Antes los presupuestos se cargaban uno por uno a ojo
y nada ataba su suma a una meta.

Lógica pura en `src/lib/presupuestos-auto.ts` (test: `presupuestos-auto.test.ts`). Es donde se
decide cuánta plata puede gastar el usuario en cada rubro: exactamente el cálculo que puede
romperse en silencio.

### El reparto

```
disponible = ingresos esperados − objetivo
factor     = (disponible − Σ promedios fijos) / Σ promedios flexibles
tope_i     = promedio_i × factor      (flexible)
tope_i     = promedio_i               (fija)
```

Los promedios salen de `promediosPorCategoria`, sobre la ventana de meses **anteriores** al que
se presupuesta (`mesesPrevios` en `fechas.ts`) — los gastos del propio mes destino no dicen nada
si todavía no arrancó — y **en la base elegida**, así el promedio y la ejecución se miden con la
misma vara.

Decisiones de los bordes, que es donde una propuesta automática miente:

- **El factor se capea en 1.** Con un objetivo holgado, inflar los topes hasta consumir todo lo
  disponible convertiría el margen en permiso para gastar. Los topes se quedan en el promedio y
  el excedente se informa como `colchon` (estado `holgado`).
- **Si lo fijo solo se pasa del disponible no se propone nada**: estado `imposible` con el
  `faltante`. Recortar lo fijo sería inventar que se puede dejar de pagar el alquiler.
- **Con recorte la suma cierra exacta**: el residuo del redondeo a centavos va a la fila
  flexible más grande. Repartir centavos entre todas acumularía deriva y dejaría un sobrante
  que no existe.
- **Las categorías con promedio ≤ 0 quedan fuera** (sin histórico, o en negativo por
  devoluciones). Escalarlas daría un tope en 0, que **no** es lo mismo que no tener tope: diría
  "acá no se gasta nada" y cualquier gasto lo excedería.
- **`missingBehavior`**, igual que en el estimado del próximo mes: un mes sin gasto en la
  categoría cuenta como 0 (default, no sobreestima las esporádicas) o se ignora
  (`average_found`).

### El reajuste manual (`reajustar`)

Al subir un tope a mano, la diferencia se saca de los demás — y al bajarlo, se les da. Lo que
hace utilizable la propuesta:

- **El total asignado no cambia**, así que si el objetivo se cumplía se sigue cumpliendo, y si
  había colchón se conserva igual.
- **La categoría tocada queda `fijado`**: si no, el propio reparto desharía el ajuste que se
  acaba de hacer.
- **El reparto es proporcional al monto actual**, que es lo que el usuario tiene en pantalla:
  las categorías que no tocó conservan su tamaño relativo entre sí.
- **Ninguna baja de 0**, y lo que no se pudo compensar sale en `no_absorbido` (siempre ≥ 0) con
  estado `imposible` — en vez de repartirse igual y mostrar un objetivo que ya no se cumple.

### Funciones

| Función | Qué hace |
|---|---|
| `promediosPorCategoria(mesesBuckets, missingBehavior?)` | Promedio por categoría sobre la ventana; descarta "Sin categoría" y los promedios ≤ 0. |
| `distribuirPresupuestos({ objetivo, ingresos, promedios, fijadas })` | La propuesta: `{ estado, disponible, filas, asignado, colchon, faltante, factor }`. |
| `reajustar(propuesta, categoriaId, nuevoMonto)` | Mueve un tope y compensa en los demás; agrega `no_absorbido`. |
| `parseGenerarBody` / `parseAplicarBody` | Validación de los bodies. Guardan contra `Number(null) === 0`, que colaría un objetivo o unos ingresos ausentes como 0. |
| `toObjetivoResponse(row)` | Mapping camelCase→snake_case del objetivo guardado. |

## API

| Route | Purpose |
|---|---|
| `GET /api/presupuestos?mes=&anio=` | Topes del período **junto con su ejecución en las dos bases**: `{ mes, anio, presupuestos, ejecucion, totales, ejecucion_caja, totales_caja, no_atribuido_caja }`. Todo en una llamada, porque separarlo obligaría al cliente a cruzar topes contra gastos por su cuenta — el cálculo que no debe estar duplicado. `ejecucion`/`totales` son **devengado** (nombres sin sufijo por compatibilidad). Los topes son los mismos en las dos: lo que cambia es contra qué se comparan. La query trae **todos** los gastos del mes (sin filtrar `esTarjeta` en el `where`) e incluye `items` con sus relaciones, porque cada base se queda con el subconjunto que le toca y caja necesita la categoría de cada sub-ítem — un solo viaje a la DB. 400 sin `mes`/`anio` válidos. |
| `POST /api/presupuestos` | Fija el tope. Body `{ categoria_id, mes, anio, monto }`. Es un **upsert** sobre el unique: desde la pantalla se edita un monto y se guarda varias veces, y que la primera sea "crear" no le importa a nadie. 400 body inválido, 404 categoría inexistente. |
| `POST /api/presupuestos/copiar` | Copia los topes del **mes anterior** al `{ mes, anio }` indicado. **No pisa lo ya cargado**: las categorías que ya tienen tope en el destino se saltean, así copiar dos veces no borra un ajuste hecho a mano. 409 si el mes anterior no tiene nada. Devuelve `{ copiados, omitidos, origen }`. |
| `POST /api/presupuestos/generar` | Propuesta de topes desde un objetivo. Body `{ mes, anio, objetivo, ingresos_esperados, meses_historico?, categorias_fijas? }`. **No persiste nada** — el wizard ajusta antes de aplicar, y escribir en cada tecla sería un viaje a la DB por pulsación. Devuelve `{ …supuestos, ventana, propuestas: { devengado, caja } }`: el promedio depende de qué se cuente como gastado, así que las dos propuestas se muestran lado a lado. 400 body inválido. |
| `POST /api/presupuestos/aplicar` | Persiste el objetivo y los topes del wizard. Body `{ …supuestos, base, filas: [{ categoria_id, monto, fijado }] }`. Los topes vienen del cliente y **no se recalculan**: son los que el usuario ajustó. **Reemplaza** los del período (`deleteMany` + `createMany` en la misma transacción que el upsert del objetivo) — a diferencia de `/copiar`, que no pisa nada: generar es una propuesta *completa* del mes, y dejar un tope viejo dando vueltas rompería la suma contra el objetivo. 400 body inválido, 404 categoría inexistente. |
| `DELETE /api/presupuestos/[id]` | Quita el tope (borra la fila — ver arriba por qué no es un 0). 400 id inválido, 404 si no existe. |

Tests: `presupuestos/route.test.ts`, `presupuestos/copiar/route.test.ts`,
`presupuestos/generar/route.test.ts` y `presupuestos/aplicar/route.test.ts`.

## UI (`src/app/presupuestos/page.tsx`)

- Usa el **mismo `filtros` del `gastosStore`** que Gastos e Ingresos: cambiar de mes acá lo
  cambia en todas.
- **Selector "Medir contra"** (`ToggleButtonGroup`, default `Devengado`) que cambia la base de
  toda la pantalla: KPIs, barras y estados. El subtítulo explica qué mide la base activa.
- Cada card muestra además, en una línea secundaria, **la misma categoría en la otra base**
  — la comparación es el motivo de tener las dos, y obligar a ir y volver con el selector para
  verla la escondería.
- En base caja, si `no_atribuido_caja` no es 0 se muestra un **alert**: hay débito que ninguna
  categoría se llevó porque los sub-ítems de algún resumen no cierran contra su total.
- Cuatro KPIs: Presupuestado / Gastado (con la base activa y el % del tope) / Restante (rojo
  si negativo) / Sin presupuesto (con el conteo de categorías excedidas).
- Si el período tiene objetivo guardado, una card arriba con **objetivo / ingresos esperados /
  cuánto se ahorra si se cumplen los topes** (verde o rojo según alcance). Ese número no depende
  de la base activa: los topes son los mismos en las dos.
- Form "Fijar un tope" que sólo ofrece las categorías **sin** tope en el período, más los
  botones "Generar automático" y "Copiar del mes anterior".
- **Wizard** (`src/components/presupuestos/GenerarPresupuestosDialog.tsx`), en dos pasos:
  1. Objetivo de ahorro, ingresos esperados (prefill de `ingresos_sugeridos`, editable), meses
     de histórico y las categorías fijas.
  2. La propuesta de la base elegida, con los KPIs de ingresos / objetivo / disponible / sin
     asignar, alerts de `imposible` y `holgado`, y cada fila editable con su promedio al lado y
     un candado para fijarla o soltarla.

  El reajuste corre **en el cliente** con la misma `reajustar` que testea el reparto: mover un
  tope tiene que ser instantáneo, y recién al aplicar se persiste. El monto se propaga al
  confirmar (Enter/blur), no en cada tecla — el reparto reescribe todas las demás filas y los
  números saltarían mientras se escribe. Aplicar avisa que reemplaza los topes del período.
- Una card por categoría con `LinearProgress` coloreado por estado. **La barra se corta en
  100** aunque el consumo lo supere: el exceso se comunica con el color y el monto en rojo,
  no estirando una barra fuera de su caja. El tope se edita inline clickeándolo.
- El borrado pide confirmación con `ConfirmDialog`, y el mensaje aclara que quitar el tope no
  es lo mismo que ponerlo en 0.
