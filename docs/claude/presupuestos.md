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

## Qué se cuenta como "gastado" (IMPORTANTE)

Lo gastado sale de **`computeReportes`** sobre el mes — la misma métrica que el reporte por
categoría —, para que las dos pantallas no puedan contradecirse. Eso arrastra su decisión
clave: se **excluyen los resúmenes de tarjeta** (`esTarjeta: false`). Sus consumos ya existen
como gastos individuales con su propia categoría; contar además el contenedor duplicaría el
consumo del presupuesto.

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

## API

| Route | Purpose |
|---|---|
| `GET /api/presupuestos?mes=&anio=` | Topes del período **junto con su ejecución**: `{ mes, anio, presupuestos, ejecucion, totales }`. Las tres cosas en una llamada, porque separarlas obligaría al cliente a cruzar topes contra gastos por su cuenta — el cálculo que no debe estar duplicado. 400 sin `mes`/`anio` válidos. |
| `POST /api/presupuestos` | Fija el tope. Body `{ categoria_id, mes, anio, monto }`. Es un **upsert** sobre el unique: desde la pantalla se edita un monto y se guarda varias veces, y que la primera sea "crear" no le importa a nadie. 400 body inválido, 404 categoría inexistente. |
| `POST /api/presupuestos/copiar` | Copia los topes del **mes anterior** al `{ mes, anio }` indicado. **No pisa lo ya cargado**: las categorías que ya tienen tope en el destino se saltean, así copiar dos veces no borra un ajuste hecho a mano. 409 si el mes anterior no tiene nada. Devuelve `{ copiados, omitidos, origen }`. |
| `DELETE /api/presupuestos/[id]` | Quita el tope (borra la fila — ver arriba por qué no es un 0). 400 id inválido, 404 si no existe. |

Tests: `presupuestos/route.test.ts` y `presupuestos/copiar/route.test.ts`.

## UI (`src/app/presupuestos/page.tsx`)

- Usa el **mismo `filtros` del `gastosStore`** que Gastos e Ingresos: cambiar de mes acá lo
  cambia en todas.
- Cuatro KPIs: Presupuestado / Gastado (con % del tope) / Restante (rojo si negativo) /
  Sin presupuesto (con el conteo de categorías excedidas).
- Form "Fijar un tope" que sólo ofrece las categorías **sin** tope en el período, más el
  botón "Copiar del mes anterior".
- Una card por categoría con `LinearProgress` coloreado por estado. **La barra se corta en
  100** aunque el consumo lo supere: el exceso se comunica con el color y el monto en rojo,
  no estirando una barra fuera de su caja. El tope se edita inline clickeándolo.
- El borrado pide confirmación con `ConfirmDialog`, y el mensaje aclara que quitar el tope no
  es lo mismo que ponerlo en 0.
