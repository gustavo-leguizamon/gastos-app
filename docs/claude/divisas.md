# Divisas (`/divisas`)

Registro de compras y ventas de dólares con su cotización y comisión, para responder tres
preguntas que la app no podía: **cuántos pesos me costaron los dólares que tengo**, **cuánto
valen hoy** y **cuántos compré contra cuántos gané**.

## Por qué no entra en Gastos, Ingresos ni Inversiones

Las tres opciones "obvias" estaban mal y la decisión es la parte importante del diseño:

- **No es un `Gasto`.** Comprar dólares no es consumo, es cambiar un activo por otro. Si
  entrara a `Gasto` inflaría el gasto del mes, rompería el presupuesto por categoría y el
  estimado del próximo mes proyectaría compras de dólares como si fueran la factura de luz.
  Por el mismo motivo una venta **no es un `Ingreso`**: no es plata nueva.
- **No es una `Inversion`.** Esa sección es snapshot-based (se carga el saldo actual) y
  [a propósito no convierte a ARS](inversiones-shared.md) — "una inversión en dólares se
  sigue en dólares, convertir mezclaría la variación del TC con el rendimiento real". Acá esa
  variación es justamente lo que se quiere medir, y para eso hace falta el **flujo**:
  cantidad, precio y comisión de cada operación, no un saldo.

La sección es standalone, igual que Inversiones: no comparte casa ni período con gastos.

## Modelo

Dos tablas (migración `20260921100000_divisas`), las dos colgando de `Moneda`:

### `OperacionDivisa`

| Campo | Notas |
|---|---|
| `fecha` | `YYYY-MM-DD`. **Sin `mes`/`anio` explícitos** (a diferencia de `Gasto`/`Ingreso`/`Sueldo`): no hay nada que imputar a otro período — una compra ocurrió el día que ocurrió, y el orden cronológico es lo único que la corrida necesita. |
| `tipo` | `'compra' \| 'venta' \| 'rendimiento' \| 'egreso'` |
| `monedaId` | La divisa que se mueve (USD, EUR). **Nunca ARS**: ARS es la otra pata de toda operación. |
| `cantidad` | **Siempre positiva.** El signo lo da `tipo`: un número negativo suelto no dice si fue una venta o la corrección de una compra cargada de más. |
| `cotizacion` | ARS por unidad. Nullable: un `rendimiento` no tuvo precio de compra. |
| `comision` + `comisionMoneda` | `'ARS' \| 'DIVISA'`. El broker cobra en pesos en la compra y en dólares en la venta o en cripto; según cuál sea cambia **la cantidad de dólares que quedó** o **los pesos que salieron**. Sin este dato ni la tenencia ni el costo cierran contra el resumen de la cuenta. |
| `plataforma` | Banco, broker, billetera. **Texto libre** por ahora (el form sugiere las ya usadas con un `Autocomplete freeSolo`, pero no obliga). |
| `descripcion` | Opcional. |

**La tenencia, el costo en pesos y el resultado no se persisten.** Se derivan recorriendo las
operaciones en orden — un saldo guardado se desincroniza del detalle que lo produjo en cuanto
se corrige una operación vieja (mismo criterio que `total_ars` en el gasto).

### `CotizacionDivisa`

`(monedaId, fecha)` único, `valor` = ARS por unidad, `fuente` informativa (BNA, MEP, blue).

Se guarda el **histórico** y no sólo el último valor porque sin él no hay curva: el valor en
pesos de la posición sólo se puede dibujar si se sabe a cuánto cotizaba en cada momento. Es
*la* referencia del día, no un registro de mercado — si se siguen varias, se carga la que se
usa para valuar y se anota cuál en `fuente`. `POST` **upsertea**: recargar el mismo día
corrige el valor en vez de dejar dos compitiendo por ser la que valúa.

## Los cuatro tipos

| tipo | Qué es | Efecto |
|---|---|---|
| `compra` | Pesos → divisa | +tenencia, +costo ARS (all-in, comisión incluida) |
| `venta` | Divisa → pesos | −tenencia, libera costo, **realiza** el resultado |
| `rendimiento` | Divisa generada (interés, ganancia de una inversión, un cobro en USD) | +tenencia **con costo 0** |
| `egreso` | Divisa que salió sin venderse (la gastaste, la transferiste) | −tenencia y su costo, sin pesos |

`rendimiento` es el que responde "cuántos gané": entra sin costar pesos y por eso **baja el
costo promedio**, que es exactamente lo que hace visible el beneficio de invertir.

Los rendimientos se cargan **a mano**. No se derivan de las `Inversion` en USD a propósito:
atarlos duplicaría el mismo dólar en las dos secciones sin nada que lo señale.

## Cálculo (`src/lib/divisas-compute.ts`, puro y testeado)

`computeOperaciones(operaciones)` **espera orden cronológico ascendente** (fecha asc, id asc),
igual que `computeMovimientos` en inversiones: cada fila se apoya en el estado que dejó la
anterior. `/api/divisas/operaciones` ya devuelve en ese orden; la página invierte el array
recién para mostrarlo.

**Costo promedio ponderado, no FIFO.** Responde directo la pregunta que importa acá sin
obligar a rastrear lotes; FIFO sólo cambia el número cuando hay que declararlo ante AFIP.

Por operación deriva:

- `divisa_neta` / `ars_neto` — lo que efectivamente entró o salió de cada lado, neto de la
  comisión que corresponda.
- **`cotizacion_efectiva`** — lo que realmente costó (o rindió) cada unidad con la comisión
  adentro. Casi nunca coincide con la cotización pactada y es el número que nadie calcula a
  mano. `null` cuando no hubo precio.
- `costo_delta`, `costo_acumulado`, `costo_promedio` — la corrida del costo.
- `resultado` — sólo en las salidas: pesos obtenidos menos el costo de la divisa entregada.
  En un `egreso` se calcula **sólo si hay cotización** de referencia; sin ella no hay contra
  qué medirlo y queda `null`.
- `tenencia`, `tenencia_comprada`, `tenencia_ganada` — los buckets.

### Los buckets comprados / ganados

Al sacar divisa, los dos buckets se drenan **proporcionales al mix del momento** (90/10 antes
de vender la mitad ⇒ 45/5 después). Es la única regla que no obliga a elegir arbitrariamente
de cuál sale, y es la consistente con el costo promedio, que ya trata a todas las unidades
como iguales.

Se mantiene la invariante `tenencia_comprada + tenencia_ganada === tenencia` **incluso con
datos inconsistentes**: si se vende más de lo que figura cargado, el excedente se carga entero
a `comprada` y la tenencia queda negativa, a la vista. El costo nunca se libera de más
(`Math.min` contra lo acumulado) ni queda en negativo propagándose a todo lo que sigue.

### Resumen y serie

`resumenDivisa(operaciones, cotizacionActual)` arma la posición: tenencia y su desglose,
`costo_total`/`costo_promedio`, `ars_invertido`/`ars_recuperado`, `resultado_realizado`,
comisiones **separadas por moneda** (sumarlas sería sumar peras con manzanas) y, cuando hay
cotización, `valor_actual`, `resultado_no_realizado`, `resultado_total` y `resultado_pct`.

`resultado_pct` es lo **no realizado sobre el costo total**: cómo viene *lo que tenés hoy*.
No incluye lo ya realizado a propósito — mezclarlo daría un porcentaje sobre una base que ya
no existe. `null` sin cotización o sin costo (una tenencia 100% ganada no costó nada).

`cotizacionVigente(cotizaciones, hasta?)` devuelve la última cargada **en o antes** de esa
fecha, nunca una posterior: valuar con un precio que en ese momento no existía mostraría una
ganancia que no ocurrió.

`serieValorizada(operaciones, cotizaciones)` arma los puntos del gráfico con la **unión** de
las fechas de operaciones y de cotizaciones, porque las dos mueven alguna de las curvas: una
compra cambia el costo, una cotización nueva el valor. `valor` es `null` mientras no haya
cotización aplicable — el gráfico deja el hueco en vez de dibujar una línea que nadie midió.

## API

Ver `docs/claude/api-surface.md`. Las cuatro routes siguen el mapping camelCase→snake_case con
`toOperacionResponse` / `toCotizacionResponse`, y validan el body con `parseOperacionBody` /
`parseCotizacionBody` (400 sin tocar la DB).

Pisos que sostiene `parseOperacionBody`:

- `cantidad > 0` — la dirección la da `tipo`.
- `cotizacion` **obligatoria y > 0** en `compra` y `venta`; opcional en `rendimiento` y `egreso`.
- `comision >= 0` — una comisión negativa sería una bonificación, que no es esto.
- `comision_moneda`: sólo `'DIVISA'` se acepta como alternativa; cualquier otra cosa cae en `'ARS'`.

## UI (`src/app/divisas/page.tsx`)

- **Tabs por divisa** (las de `/api/monedas` menos ARS), USD por defecto. El tab se oculta si
  hay una sola.
- `ResumenDivisaCards` — ocho tiles en dos bloques: **la posición** (tenencia con su desglose
  y una barra con la proporción ganada, costo promedio, costo total, valor hoy) y **el
  resultado** (sin realizar, realizado, total, comisiones). La separación realizado / sin
  realizar es la que evita leer como plata en la cuenta algo que todavía depende de la
  cotización de mañana.
- `EvolucionDivisaChart` — **costo contra valor**, las dos en pesos. Ninguna sola dice nada:
  la tenencia en dólares es plana aunque el TC se duplique, y el valor en pesos sube aunque
  sólo estés comprando más. La distancia entre las curvas es la ganancia latente. No se
  renderiza con menos de dos puntos.
- `OperacionDivisaDialog` — alta/edición. Tiene **preview en vivo**: el borrador se intercala
  en la corrida real en su posición cronológica (sacando la operación original cuando se está
  editando) y se muestra con `computeOperaciones`, **la misma función que después calcula la
  grilla** — lo que se ve antes de guardar es lo que se guarda. Es lo que hace que la
  cotización efectiva y el resultado de una venta se vean *antes* de confirmar.
- `CotizacionesDialog` — ABM del histórico. El botón del header muestra la última cargada.
- Grilla desktop (`AppDataGrid`, default sort `fecha desc` con el mismo pre-reverse que
  inversiones para el desempate por `id`) y cards en mobile.
- `formato.ts` — los formatters compartidos. Viven aparte porque si cada componente redondea a
  su manera la grilla deja de coincidir con los tiles.

## Pendientes conocidos

- `plataforma` es texto libre; si se llena de variantes del mismo nombre, promoverla a entidad
  (como `Concepto`/`Categoria`).
- La cotización se carga a mano. Un fetch a `dolarapi.com` encajaría sin tocar el cálculo:
  `serieValorizada` y `resumenDivisa` ya reciben el precio desde afuera.
