# Ingresos y ahorro del mes

Sección para registrar **cuánta plata entró** en el mes y compararla contra lo que salió. El
ingreso mensual no es un único monto: los cobros entran en días distintos (sueldo, alquiler
cobrado, una venta) y se cargan como varias entradas que se **suman**.

## Modelo (`prisma/schema.prisma`)

```prisma
model Ingreso {
  id          Int      @id @default(autoincrement())
  fecha       String   // YYYY-MM-DD del cobro
  mes         Int      // mes/año al que se IMPUTA (explícito, no derivado de `fecha`)
  anio        Int
  monedaId    Int
  tipoCambio  Float    @default(1)
  montoMoneda Float
  descripcion String?
  casaId      Int?     // null = ingreso "general"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  casa   Casa?  @relation(fields: [casaId], references: [id])
  moneda Moneda @relation(fields: [monedaId], references: [id])

  @@index([anio, mes])
}
```

Migraciones: `20260815090000_add_ingreso/` (modelo inicial) y `20260815120000_ingreso_moneda/`
(renombra `monto` → `montoMoneda`, agrega `monedaId`/`tipoCambio` y backfillea lo existente a
ARS con tipo de cambio 1 — equivalente exacto, porque todo lo cargado hasta ahí era ARS).

Tres decisiones del modelo:

- **`mes`/`anio` explícitos**, igual que en `Gasto`: permiten imputar a agosto un cobro que
  entró el 31 de julio. El form siempre manda el mes que se está mirando.
- **`casaId` opcional**: un cobro como el sueldo no pertenece a una casa. Al filtrar por casa
  los ingresos sin casa se incluyen igual (`buildIngresosWhere` arma
  `OR: [{ casaId: n }, { casaId: null }]`) — si no, el ahorro de esa casa daría siempre negativo.
- **Moneda con el mismo mecanismo que `Gasto`**: `montoMoneda * tipoCambio` = monto en ARS,
  con `tipoCambio` en 1 cuando la moneda es ARS. No se inventó un esquema propio para que
  haya una sola forma de manejar moneda en toda la app. El monto en ARS **nunca se persiste**:
  se deriva en el response (`monto_ars`), igual que `total_ars` en el gasto.

Naming convention habitual: schema camelCase, API/types snake_case (`casa_id`, `monto_moneda`).

## Lógica pura (`src/lib/ingresos-compute.ts`)

Sin imports de Prisma/Next; testeada en `ingresos-compute.test.ts`.

| Función | Qué hace |
|---|---|
| `mesAnioDeFecha(fecha)` | Mes/año de un `YYYY-MM-DD` **parseado como string**, nunca con `new Date()` (interpretaría el string como UTC y correría el día — y con él el mes — en Argentina). `null` si el formato o los rangos no cierran. |
| `parseIngresoBody(body)` | Valida y normaliza el body snake_case al shape camelCase de Prisma. `mes`/`anio` del body si vienen, si no derivados de `fecha`. `moneda_id` obligatorio (entero > 0); `tipo_cambio` default 1 y **debe ser > 0** (mismo piso que en el gasto). `descripcion` vacía → `null`. **Montos negativos permitidos** en `monto_moneda` (corregir un ingreso cargado de más). `null` → la route responde 400 sin tocar la DB. |
| `buildIngresosWhere(mes, anio, casaId)` | `where` de Prisma compartido por `/api/ingresos` y `/api/resumen`, para que la lista y la card no puedan mostrar totales distintos. Incluye los ingresos sin casa al filtrar por casa. |
| `toIngresoResponse(row)` | Mapping camelCase→snake_case de la respuesta, con `moneda_codigo`/`moneda_simbolo` del include y `monto_ars` derivado. Vive en `lib` y no en el `route.ts` porque **Next rechaza en build cualquier export de un `route.ts` que no sea un método HTTP**, y la route de `[id]` necesita el mismo mapper. |
| `montoArs(row)` | `montoMoneda * tipoCambio`, redondeado. |
| `sumIngresos(rows)` | Total del mes en ARS, sobre filas **de Prisma** (convierte cada una). La usa el server. |
| `sumMontosArs(rows)` | Mismo total sobre filas **ya mapeadas a la API** (que traen `monto_ars`). La usa el cliente (`useIngresos`), que nunca ve el shape camelCase — así el redondeo del total vive en un solo lugar. |
| `computeAhorro(ingresos, totalDebito)` | `{ total_ingresos, ahorro, ahorro_pct }`. El segundo parámetro es **lo gastado en débito/efectivo**, que calcula `computeResumen`. |

### Definición de "ahorro"

```
monto_ars      = montoMoneda × tipoCambio              (por ingreso)
total_ingresos = Σ monto_ars del mes
total_debito   = Σ total_ars de los gastos con tipoPago === 'D'
total_ahorro   = total_ingresos − total_debito
ahorro_pct     = total_ahorro / total_ingresos × 100   (0 si no hay ingresos)
```

Todos los agregados y comparaciones son **en ARS**: un ingreso en USD entra al total ya
convertido con su tipo de cambio.

Se compara contra **lo gastado en débito/efectivo** (`total_debito`, calculado en
`computeResumen`), que es la plata que sale de la cuenta:

- **Cuenta el total cargado, no lo pagado.** Un débito ya cargado se considera plata ida
  aunque no tenga el pago registrado — así el ahorro no se infla por pagos sin cargar.
- **Los consumos de crédito no restan.** Restan cuando se paga el resumen de la tarjeta, que
  se carga como `tipoPago: 'D'` (con `esTarjeta: true`) porque se paga de la cuenta. Por eso
  filtrar por débito incluye el resumen y excluye los consumos individuales: **no hay doble
  conteo**.
- **`prestamo_a_otro` y `pasaje_mes_siguiente` no se descuentan** del débito: si salieron de
  la cuenta este mes, bajan el ahorro este mes (a diferencia de `total_gastos_neto`, que sí
  los resta).
- En un gasto **no confirmado con sub-items** se usa la suma de los sub-items
  `incluyeEnTotal`, igual que el resto de los totales del resumen.

`ahorro` puede ser negativo (se gastó más de lo que entró); la card lo pinta en rojo.

## API

| Route | Purpose |
|---|---|
| `GET /api/ingresos` | Lista del mes. Params `mes`, `anio`, `casa_id`. Orden `fecha desc, id desc`. Incluye `casa` y `moneda`. |
| `POST /api/ingresos` | Alta. Body `{ fecha, monto_moneda, moneda_id, tipo_cambio?, descripcion?, casa_id?, mes?, anio? }`. 400 si `parseIngresoBody` rechaza el body. 201 con el ingreso creado. |
| `PUT /api/ingresos/[id]` | Edición. 400 id/body inválido, 404 si no existe. |
| `DELETE /api/ingresos/[id]` | Borrado. 400 id inválido, 404 si no existe. |

Tests en `src/app/api/ingresos/route.test.ts` y `src/app/api/ingresos/[id]/route.test.ts`.

`GET /api/resumen` suma los ingresos del mes en la misma tanda de queries paralelas y los pasa
a `computeResumen(..., ingresos)`, que agrega al response `total_ingresos`, `total_debito`,
`total_ahorro` y `ahorro_pct`.

## UI

**Sección `/ingresos`** (`src/app/ingresos/page.tsx`) — item "Ingresos" en `TopBar`, entre
Gastos y Reportes (icono `PaymentsIcon`).

- Usa el **mismo `filtros` del `gastosStore`** que el dashboard: cambiar de mes acá deja
  Gastos en ese mes, y viceversa.
- Tres KPIs arriba: **Ingresado** / **Gastado en débito** / **Ahorrado** (con el % y coloreado
  según signo). "Gastado en débito" sale de `GET /api/resumen` (`total_debito`), no se recalcula.
- Form de alta/edición + `AppDataGrid` en desktop y tarjetas en mobile, con `ConfirmDialog`
  para el borrado. La grilla muestra **Monto** (en su moneda), **T. Cambio** (`—` si es ARS)
  y **En ARS**; en mobile el monto original sólo aparece si la moneda no era ARS.

**Cards en el dashboard de Gastos** (`ResumenCards`): se agregaron **Ingresos** (teal) y
**Ahorro** (violeta, rojo si es negativo). La card de Ingresos es un `CardActionArea` que abre
`IngresosDialog` — ABM rápido del mes sin salir de Gastos. Sin ingresos cargados, Ahorro
muestra `—` en vez de un negativo que no informa nada.

**Componentes** (`src/components/ingresos/`):

| Archivo | Rol |
|---|---|
| `useIngresos.ts` | Hook con el estado + ABM del mes (`guardar`/`eliminar`/`reload`) y el total vía `sumIngresos`. Compartido por la página y el dialog para que no diverjan. |
| `IngresoForm.tsx` | Form de alta/edición (fecha, monto, moneda, descripción, casa si hay más de una). **ARS viene preseleccionada** — se busca por `codigo === 'ARS'`, nunca por id hardcodeado, porque el id de la moneda no es estable entre entornos. El select de moneda sólo se muestra si hay más de una cargada. El **tipo de cambio y el equivalente en ARS aparecen únicamente si la moneda no es ARS** (mismo criterio que `GastoForm`), y volver a ARS lo resetea a 1. El input del tipo de cambio usa `step: 'any'` con `min: 0`: acepta cotizaciones con **más de 2 decimales**, y evita el bug de que el browser valide el paso contra la base `min` (con `min: 0.0001` + `step: 0.01`, un valor como `1517.56` quedaba rechazado). El piso > 0 lo imponen el submit del form y `parseIngresoBody`, no el input. `layout="row"` en la página, `"stack"` en el dialog. Acota el date picker al mes visible y exporta `fechaInicial(mes, anio)` — hoy si cae en el mes, si no el día 1. |
| `IngresosDialog.tsx` | ABM del mes abierto desde la card. Llama `onChanged` en cada alta/edición/borrado para refrescar el resumen. |

Toda alta/edición/borrado dispara `triggerResumenRefresh()` del `gastosStore`, así las cards
de Gastos quedan al día sin recargar la tabla.
