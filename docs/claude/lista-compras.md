# Lista de compras (`/lista-compras`)

Sección para armar **lo que hay que comprar en el mes** (casi siempre supermercado, pero el
rubro es libre) y guardar **cuánto se compró y a qué precio**, para que el mes siguiente ese
precio aparezca como referencia. No es el `/presupuestos` de la app (topes por categoría):
ese mide gasto contra un límite; éste es una lista de artículos con cantidades y precios.

Entrada desde `TopBar` ("Lista de compras", `ShoppingCartIcon`). Comparte mes/año con el resto
de la app vía `useGastosStore().filtros`.

## Modelo (`prisma/schema.prisma`)

- **`Unidad`** y **`Rubro`** — tablas de catálogo (`nombre` único; `Unidad.subunidadDe`, ver
  "Precio por kg / litro"). La unidad (un, kg, l, pack…)
  y el rubro (Almacén, Limpieza…) **no son texto libre**: en pantalla se elige de las existentes
  o se agrega una nueva, y lo que queda guardado es siempre una FK. Evita "kg"/"Kg"/"kilo"
  como tres unidades distintas.
- **`Articulo`** — catálogo de artículos: `nombre`, `unidadId` (obligatoria), `rubroId?`
  (null = sin rubro; `onDelete: SetNull`). El nombre es único **sin distinguir mayúsculas**,
  resuelto en `resolveArticulo()` (find-or-create, igual que `Concepto`), no con un índice.
  `mostrarEnMultiplo` (default false; migración `20261105120000_articulo_mostrar_en_multiplo/`): en
  artículos en g/ml, ver y cargar las cantidades en kg/l — sólo presentación, ver "Cantidades".
- **`ListaCompraItem`** — una línea por `(articuloId, mes, anio)` (único): `cantidad`,
  `precioUnitario?`, `cantidadComprada` (default 0). `precioUnitario` **null = sin precio** (≠ 0,
  que es un precio válido). `onDelete: Cascade` desde el artículo.

Migración `20261103160000_unidad_subunidad_de/` (agrega `Unidad.subunidadDe` y la completa para
las unidades existentes con nombres obvios: g/gr/grs/gramo(s) → kg, ml/mls/cc/mililitro(s) → l).

Migración `20261103140000_lista_compras_cantidad_comprada/`: cambia el sí/no `comprado` por
`cantidadComprada` (lo ya marcado como comprado se convierte en `cantidadComprada = cantidad`
antes de borrar la columna).

Migraciones: `20261103100000_lista_compras/` (modelo inicial, con `unidad`/`rubro` como texto) y
`20261103120000_lista_compras_unidad_rubro/` (crea `Unidad`/`Rubro`, las siembra con
un/kg/g/l/ml/pack **más** los textos distintos ya cargados —agrupados sin distinguir
mayúsculas—, hace el backfill de `unidadId`/`rubroId` y recién después borra las columnas de texto).

Decisiones:

- **Se persiste precio *unitario***, no el total: el total (`cantidad × precio`) se deriva en el
  response (`total`) y nunca se guarda.
- **La referencia no se persiste**: es la compra **con precio más reciente anterior al mes
  mirado** (`referenciaDe`), aunque haya sido hace varios meses. Si salteaste un mes, no se pierde.
- Quitar una línea (`DELETE`) borra sólo ese mes; el artículo y su historial quedan.
- `unidad`/`rubro` son del **artículo** (valen para todos los meses); cantidad, precio y
  cantidad comprada son de la línea.
- **Compras parciales**: `cantidadComprada` es el **acumulado** que se lleva (no el de una
  compra puntual), así que se puede ir completando en varias compras. **"Comprado" no se guarda:
  se deriva** (`esCompleto`: `cantidadComprada >= cantidad`, con tolerancia de float). Así no hay
  dos datos que se contradigan al cambiar la cantidad (si subís lo que necesitás de 2 a 3 con 2
  llevados, pasa a "en curso"). Se puede llevar de más: queda completo y `faltante` nunca es negativo.
- **Precio por kg / litro / metro (unidades g, ml y mm)**: `Unidad.subunidadDe` (`'kg'` | `'l'` |
  `'m'` | null) marca que la unidad es **la milésima parte** de kg, litro o metro (g → kg, ml → l,
  mm → m; `FACTOR_SUBUNIDAD = 1000`; `SUBUNIDAD` da la chica de cada base). **Todo lo que sigue
  sobre g/ml y kg/l vale igual para mm y m** (precio por metro, selector mm | m, preferencia de
  visualización, rechazo de "m" como unidad de artículo).
  Cuando el artículo usa una unidad así, el precio **se carga y se ve por kg/litro** (campo
  "Precio por kg") pero **se persiste siempre por la unidad de la línea** (`precioUnitario` por
  gramo): así el total (`cantidad × precio`), `gastado`, `estimado`, la referencia y la
  variación no cambian ni necesitan saber de conversiones. 500 g a $4.000/kg → se guarda $4 por g
  → total $2.000. La pantalla muestra el precio por g/ml como aclaración ("= $4 por g"). La
  conversión es de presentación: `aPrecioBase` / `desdePrecioBase` (con redondeo a 6 decimales
  para no mostrar `3999.9900000000002`), usadas por el cliente; la API sigue hablando en precio
  por unidad de la línea y sólo agrega `subunidad_de` a cada ítem.
  - Al **crear** una unidad la equivalencia se **infiere del nombre** (`inferirSubunidad`: g, gr,
    grs, gramo(s) → kg; ml, cc, mililitro(s) → l; mm, milímetro(s) → m; sin acentos ni mayúsculas ni
    puntos; la "mm" que ya existía se completó con la migración de datos
    `20261105150000_unidad_mm_subunidad_m/`). Cualquier
    otro nombre queda sin equivalencia y se puede fijar a mano en "Administrar unidades y rubros"
    (select "Equivale a 1/1000 de").
  - Cambiar la equivalencia (o la unidad de un artículo) **no reconvierte** precios ya guardados:
    cambia cómo se interpretan/muestran, así que conviene hacerlo antes de cargar precios.
- **Cantidades siempre en la unidad chica (g / ml / mm / un)**: ningún artículo usa kg, l ni m. Las
  cantidades (`cantidad`, `cantidadComprada`, la `cantidad` de cada compra) se **registran en
  g/ml**; en pantalla, en los artículos en g/ml, cada campo de cantidad tiene a la derecha un
  selector **g | kg** (ml | l) para elegir en qué se está cargando (`CampoCantidad`): "1" con kg
  se registra **1000**. Lo usan el alta, "Llevo" y "Necesito" de cada fila (escritorio y celular),
  el diálogo de compra y la carga desde imagen (si el OCR leyó "2 kg manzanas", la fila arranca
  con kg elegido; "2 kg" de algo nuevo se da de alta en g). La API no sabe de kg: recibe y
  devuelve g/ml.
  - Conversión pura: `aCantidadBase(valor, multiplo)` / `desdeCantidadBase` (×/÷ 1000, redondeo a 6
    decimales: 1,1 kg → 1100, no 1100.0000000000002).
  - **La unidad en que se ve es una preferencia del artículo** (`Articulo.mostrarEnMultiplo`, API
    `mostrar_en_multiplo` en cada ítem y en `/articulos`; `PUT /api/lista-compras/[id]` lo acepta y va
    al artículo, aunque la línea tenga compras). Elegir kg en "Llevo" o "Necesito" la guarda (en el
    mismo PUT que la cantidad, sólo si cambió) y vale para los dos campos, todos los meses y todos los
    dispositivos. Con ella también se muestran en kg/l "Faltan …", "Pasaste por …", la cantidad de
    "Última vez" y la de cada compra (`fmtCantidad` en `formato.ts`). El diálogo de compra, el alta
    (al elegir un artículo del catálogo) y la carga desde imagen arrancan en esa unidad, pero ahí
    cambiar el selector no la guarda. Un artículo **nuevo** cargado en kg se crea con la preferencia
    (`mostrar_en_multiplo` en el `POST`; uno existente conserva la suya).
  - **Cambiar el selector** (`textoAlCambiarUnidad`): si el campo muestra todavía la cantidad de
    referencia (lo guardado o precargado) se **convierte** (2500 g → 2,5 kg; es la misma cantidad
    y no se guarda nada distinto); si ya se tipeó otro número, se **conserva** y pasa a
    significar kg ("1" + kg = 1000 g).
  - En las filas (edición en línea) se guarda al salir del campo **o al elegir la unidad**; ir del
    campo a su propio selector no guarda (el número tipeado todavía puede cambiar de significado).
    Si el artículo deja de estar en g/ml, el kg elegido se ignora.
  - Los +/− del celular suman/restan el paso en g/ml (100) aunque se vea en kg.
  - **kg, l y m no son unidades de artículo**: `POST /api/lista-compras/unidades` y el renombre
    (`PUT .../unidades/[id]`) responden **400** con un nombre múltiplo (`esUnidadMultiplo`: kg,
    kilo(s), kilogramo(s), l, lt(s), litro(s), m, mt(s), metro(s); sin acentos, mayúsculas ni puntos)
    con el mensaje `errorMultiplo` ("usá g y elegí kg al cargar la cantidad"; mm/m para metros).
    El OCR también reconoce metros y milímetros ("30 metros papel").
  - Los artículos que estaban en kg/l/m se pasan a g/ml/mm con
    `node scripts/migrar-lista-compras-a-unidades.js [--apply]` (dry-run por defecto): cambia la
    unidad del artículo y le deja `mostrarEnMultiplo` en true (se sigue viendo en kg/l/m),
    multiplica por 1000 las cantidades de sus líneas y compras y divide por 1000 sus precios (lo
    pagado no cambia), y borra las unidades kg/l/m. Necesita la migración de datos de "mm" aplicada. La DB es una sola para
    todos los ambientes: correrlo **después** de desplegar este cambio.
- **Un solo precio unitario por línea**: si las compras parciales salieron a precios distintos,
  se carga el último/promedio; no hay precio por compra.
- **Agregar una unidad/rubro nuevo es un paso aparte** (`POST /api/lista-compras/unidades|rubros`)
  *antes* de guardar el artículo: la API de ítems sólo recibe ids y responde 400 si no existen.
  Renombrar y borrar van por `PUT/DELETE .../unidades|rubros/[id]`: **renombrar** cambia el
  nombre en todos los artículos (apuntan por id) y rechaza con 409 un nombre que ya tenga *otra*
  fila (sin distinguir mayúsculas; corregir el casing de la propia fila sí vale). **Borrar** sólo
  si ningún artículo la usa: en uso → 409 con la cantidad, sin tocar nada (borrarla dejaría
  artículos sin unidad, o pasaría a "sin rubro" en silencio).

## Lógica pura (`src/lib/lista-compras-compute.ts`, test `lista-compras-compute.test.ts`)

`parseItemBody` (alta: `unidad_id` obligatoria, `rubro_id` opcional), `parseItemPatch` (edición
parcial: sólo las claves presentes; `cantidad_comprada >= 0`; `precio_unitario: null` **borra** el precio y
`rubro_id: null` quita el rubro), `parseNombreCatalogo` (alta de unidad/rubro), `parseCopiarBody`, `referenciaDe`,
`variacionPrecio` (% contra la referencia), `parseSubunidadDe`, `inferirSubunidad`, `aPrecioBase`,
`desdePrecioBase`, `parseUnidadPatch` (nombre y/o `subunidad_de`), `esCompleto`, `resolverPatchComprado` (traduce el atajo
`comprado: true|false` a `cantidadComprada` = lo pedido / 0; una `cantidad_comprada` explícita
gana, y nunca se persiste `comprado`), `toItemResponse` (agrega `cantidad_comprada`, `faltante`,
`comprado` derivado y `total`/`total_llevado` de `importesLinea`), `totalesLista`:

- **`importesLinea`** (por línea): sin compras registradas, `total_llevado` = llevado × precio y
  `total` = cantidad × precio. **Con compras**, `total_llevado` = **lo realmente pagado** (Σ
  `cantidad × precio` de cada compra: una compra a $0 cuesta 0, aunque el promedio no la cuente);
  las compras sin precio se valorizan al precio de la línea (sin él, `null`), y `total` =
  `total_llevado` + lo que falta × precio (comprar de más no lo baja de lo pagado).
- `estimado` = Σ `total` de la línea o, sin precio, `cantidad × precio de referencia`.
- `gastado` = Σ `total_llevado` (lo que **ya se compró**): un precio sin nada llevado todavía no
  suma al gastado, sí al estimado.
- `comprados` = líneas completas, `parciales` = con algo llevado pero no todo, `pendientes` = no
  completas (incluye las parciales).
- `sin_precio` = líneas sin precio propio ni referencia (no entran al estimado).

`src/lib/lista-compras-catalogo.ts` (`renombrarCatalogo`, `actualizarUnidad` —nombre + equivalencia, sin
guardar la equivalencia si el nombre choca—, `borrarCatalogo`; test `lista-compras-catalogo.test.ts`):
las reglas de renombrar/borrar, compartidas por unidades y rubros; reciben el delegate de
Prisma y devuelven `{ status, body }` para que las routes sean un envoltorio fino.

`src/lib/lista-compras-db.ts`: `antesDe(mes, anio)` (filtro Prisma de "período anterior",
con wraparound de año), `resolveArticulo`, `INCLUDE_ARTICULO` (unidad + rubro del artículo) y
`resolveCatalogo` (find-or-create case-insensitive de una `Unidad`/`Rubro`, con reintento ante
la carrera P2002; devuelve si la creó para responder 201 vs 200).

## API

Ver `docs/claude/api-surface.md`. `GET /api/lista-compras` resuelve las referencias con **una
sola query** de histórico para todos los artículos de la lista.

## Página

- KPIs: **Estimado del mes**, **Gastado** (cantidad llevada × precio), **Comprados** (x / y, con
  cuántos están en curso).
- **Agregar artículo**: autocompleta del catálogo (excluye los que ya están en el mes) y
  prefillea unidad/rubro. Unidad (default `un`) y rubro se eligen con `CatalogoSelect`: lista
  de las existentes y, si lo tipeado no existe, la opción **"Agregar «…»"** que lo crea y lo
  selecciona (no admite texto libre). El rubro es opcional. 409 si el artículo ya está en el mes.
  **El alta no pide precio**: el precio del artículo sale de las compras registradas (es su promedio
  ponderado) y el diálogo de compra ya ofrece como punto de partida el último precio conocido
  (promedio actual o la referencia del mes anterior). La API de alta (`POST /api/lista-compras`)
  sigue aceptando `precio_unitario` opcional, pero la pantalla no lo envía.
- **Administrar unidades y rubros** (botón junto a "Agregar artículo", `CatalogoAdminDialog`):
  lista cada unidad/rubro con cuántos artículos la usan; **renombrar** inline (Enter guarda,
  Esc cancela; si el nombre está repetido avisa y queda en edición) y **borrar** con
  confirmación — el botón está deshabilitado mientras esté en uso. Al abrirlo se recargan los
  conteos. Si lo borrado estaba elegido en el formulario de alta, se limpia.
- **Editar un artículo (nombre, rubro y unidad)**: casi nunca cambian, así que **no están siempre en
  pantalla**. Bajo el nombre de cada fila se ve "Rubro · unidad" de sólo lectura (`NombreArticulo`), y el
  lápiz junto al nombre despliega el editor del artículo (`EditorArticulo` de `FilaLista`, igual en
  escritorio y celular): nombre, rubro y unidad (`CatalogoSelect`) y "Listo" para cerrarlo; el lápiz
  queda resaltado mientras está abierto. El nombre se guarda con Enter o al salir del campo (Esc lo
  deshace y cierra); rubro y unidad, al elegirlos.
- **Renombrar** (desde ese editor): manda `{ nombre }` al `PUT /api/lista-compras/[id]`, que renombra el **artículo**
  (se ve en todos los meses y en el catálogo del alta) y conserva su historial de precios. El
  nombre se normaliza (`parseItemPatch`: trim + colapso de espacios; vacío = 400) y responde
  **409** si **otro** artículo ya tiene ese nombre sin distinguir mayúsculas (no se fusionan: se
  mezclarían los históricos); el propio se excluye, así que corregir mayúsculas vale. Se permite
  aunque la línea tenga compras registradas. El error del server se muestra en un toast.
- **Buscador** arriba de la lista ("Buscar artículo o rubro"; Esc o la X lo limpian). Filtra mientras se
  escribe con `coincideBusqueda`: ignora mayúsculas y acentos (`normalizarBusqueda`) y **todas las
  palabras** tienen que aparecer, en cualquier orden y aunque sean parte de una palabra, en el nombre
  **o en el rubro** ("yer" → Yerba mate; "alm yer" → Yerba del rubro Almacén). Se ocultan los rubros
  sin coincidencias, los que tienen alguna se muestran **desplegados aunque estén plegados** (con
  el encabezado sin interacción mientras se busca, y "N de M" además del resumen), y se oculta
  "Colapsar todos". Debajo se ve "N de M artículos" o "Ningún artículo coincide con «x»". Los
  totales de arriba (estimado, gastado, comprados) **no se filtran**: son los del mes. Lo escrito no se
  recuerda al recargar.
- **Filtro por estado** (chips debajo del buscador, con la cantidad de cada uno): **Todos**, **Faltan**
  (sin compras o por debajo de lo pedido), **Comprados** (ya se llevó lo pedido, **incluidos** los que
  se pasaron) y **De más** (sólo los que se llevaron más de lo pedido). Lo decide `coincideEstado`
  sobre `estadoCantidad` (Faltan y Comprados son complementarios); los contadores salen de
  `contarPorEstado` sobre todo el mes, sin aplicar la búsqueda. Tocar el chip activo vuelve a Todos.
  Se combina con el buscador (AND) y se comporta igual que él: rubros sin líneas ocultos, los demás
  desplegados con "N de M", sin "Colapsar todos", y "No hay artículos en este estado" si no queda
  ninguno. Tampoco filtra los totales de arriba ni se recuerda al recargar.
- **Rubros plegables**: el encabezado de cada rubro se toca para plegarlo/desplegarlo. Plegado sigue
  mostrando "x/y comprados · $estimado del rubro" (`totalesLista` sobre las líneas del grupo), así no
  hace falta abrirlo para saber cómo viene. Si hay más de un rubro aparece **Colapsar todos / Expandir
  todos**. Qué rubros están plegados se **recuerda en el navegador** (`localStorage`,
  `lista-compras:rubros-colapsados`, por nombre de rubro; `parseColapsados` tolera cualquier valor roto):
  es una comodidad por usuario, no un dato de la lista. Se lee en un efecto al montar (no en el estado
  inicial, que desajustaría el HTML del server), y no se escribe hasta haber leído para no pisar lo
  guardado con el estado vacío del primer render. Agregar un artículo a un rubro plegado lo
  **despliega**, para que no parezca que no se agregó.
- **Lista agrupada por rubro** ("Sin rubro" al final). Cada fila: checkbox *comprado* (tildar = llevo todo lo pedido, destildar = nada; queda en estado
  indeterminado si hay compra parcial), barra de progreso con "Faltan X u" cuando está en curso,
  campo de **precio por kg/litro** cuando la unidad es g/ml/mm (la referencia también por kg/l/m),
  **precio por unidad de sólo lectura** en las dos unidades (`PreciosPorUnidad`, sólo artículos con
  equivalencia y con precio): "por **g**" (unidad individual, como se guarda; `fmtPrecioUnitario` muestra
  hasta 4 decimales por debajo de $100, porque un g o un mm cuesta centavos) y "por **kg**" (unidad
  mayor), cada uno en su propio recuadro con la unidad en negrita y un tooltip — en escritorio apilados
  en una columna, en el celular lado a lado con el rótulo "Unidad individual" / "Unidad mayor",
  campo **Llevo** (acumulado, se actualiza en cada compra) junto a **Necesito**, "llevo $X" bajo
  el total cuando es parcial,
  referencia ("Última vez: $X × cant (mm/aaaa) ▲/▼ %" — el % sólo si hay precio este mes),
  **rubro y unidad** (en el editor del artículo, detrás del lápiz; son del artículo, así que el cambio vale para todos los meses y, al cambiar el rubro, la fila se mueve de grupo; el rubro se puede quitar), cantidad y precio editables inline (se guardan al salir del campo / Enter; el placeholder
  del precio es el de referencia) y total de la línea.
- **Copiar del mes anterior**: trae artículos y cantidades del último mes con lista; **no copia
  precios** (quedan vacíos, la referencia los muestra) ni lo llevado (arrancan en 0), y no pisa lo ya cargado.

## Compras registradas y precio promedio

Cuando un artículo se compra en varias veces y a precios distintos, en vez de pisar un único
precio se **registra cada compra** (cantidad, precio y fecha) y el precio de la línea pasa a ser
el **promedio ponderado por cantidad**.

- **Modelo** `ListaCompraCompra` (`itemId`, `cantidad > 0`, `precioUnitario?`, `fecha` `YYYY-MM-DD`;
  cascade desde la línea). Migración `20261103180000_lista_compras_compras/` (tabla nueva y vacía:
  no migra datos). `precioUnitario` null = no se anotó el precio de esa compra.
- **Promedio ponderado, no simple** (`resumenCompras`): 2 kg a $1.000 + 3 kg a $1.100 → $1.060 (el
  simple daría $1.050); con promedio simple pesaría igual una compra de 1 u que una de 9. Las
  compras sin precio **o con precio 0** suman cantidad pero no entran al promedio (un 0 hundiría la
  referencia del mes siguiente); si todas están en 0 o sin precio, la línea conserva el suyo. Por
  eso lo gastado **no** es `llevado × promedio` sino lo pagado en las compras (`importesLinea`):
  400 g a $7.525/kg + 400 g gratis + 600 g a $7.093,75/kg → promedio $7.266,25/kg, gastado $7.266,25.
  Las líneas guardadas con la regla vieja (el 0 dentro del promedio) se corrigen con
  `node scripts/recalcular-promedios-lista-compras.js [--apply]` (dry-run por defecto, idempotente).
  El promedio se guarda **sin redondear** (para que los totales cierren), pero en los campos de
  precio de la fila y en el precargado del diálogo de compra se muestra **a centavos**
  (`precioCampo` en `formato.ts`: 5190.178571 → 5190.18). Salir del campo de precio sin tocarlo
  no guarda el valor redondeado.
- **Se guarda denormalizado en la línea**: tras cada alta/edición/baja el server recalcula
  (`recalcularLinea`) `cantidadComprada` = suma y `precioUnitario` = promedio. Así los totales, la
  referencia del mes siguiente, `copiar` y el catálogo siguen leyendo los mismos campos de
  siempre y la referencia del mes siguiente **es el promedio del mes**. Si ninguna compra tiene
  precio, el precio de la línea **no se toca** (no se borra lo cargado a mano); al borrar la última
  compra, lo llevado vuelve a 0 y el precio **se conserva**.
- **Líneas sin compras siguen igual**: lo llevado y el precio se cargan a mano (campo "Llevo",
  +/−, tilde). Con **compras registradas esos campos se bloquean** (el tilde, "Llevo", los +/− y el
  precio, que pasa a rotularse "Precio promedio") y `PUT /api/lista-compras/[id]` responde **409**
  si se intenta editar `cantidad_comprada`, `comprado` o `precio_unitario`: se pisarían en la
  próxima compra. "Necesito" (la cantidad pedida), rubro y unidad se siguen editando.
- **Primera compra sobre una línea con "Llevo" cargado a mano**: ese valor (con el precio de la
  línea) se convierte antes en una **compra inicial**; si no, registrar la primera compra pisaría
  lo que ya se llevaba. (No es atómico: son varias escrituras seguidas; si fallara a la mitad, la
  siguiente operación recalcula desde las compras que haya.)
- **Fecha**: la manda el cliente (fecha local, `hoyLocal()`), nunca la UTC del server. `fechaValida`
  rechaza fechas inexistentes (2026-02-30) y se parsea a mano, sin `Date`.
- **Pantalla**: botón **Registrar compra** (carrito con "+" en escritorio; botón ancho en móvil) abre
  `CompraDialog`, que ofrece lo que **falta** como cantidad y el último precio conocido (promedio
  o, si no hay, la referencia); con unidad g/ml el precio se tipea por kg/litro. Un toggle
  "N compras ▾" despliega el detalle (fecha, cantidad × precio, editar/borrar) y el promedio
  ponderado. Borrar una compra pide confirmación.

## Alertas de cantidad (lo llevado vs. lo pedido)

Cada línea se compara con su **cantidad pedida** ("Necesito", el límite previsto) y se resalta
**cualquier diferencia** (`estadoCantidad`, con tolerancia sólo para el error de float):

| Estado (`estado_cantidad`) | Cuándo | Cómo se ve |
|---|---|---|
| `sin_compras` | no se llevó nada | sin resalte: está **pendiente**, no es una alerta |
| `por_debajo` | algo llevado, menos de lo pedido | borde y fondo **naranjas**, barra naranja y "Faltan X u" |
| `completo` | justo lo pedido | barra verde "Completo" y la fila atenuada y tachada |
| `por_encima` | se llevó **más** de lo pedido | borde y fondo **rojos**, barra roja y "⚠ Pasaste por X u" |

- La API agrega a cada línea `estado_cantidad` y `exceso` (cuánto se pasó; `faltante` ya existía).
  `comprado` sigue siendo "llevado ≥ pedido", así que incluye a los pasados.
- **Sólo lo justo se atenúa/tacha**: lo que se pasó o falta tiene que seguir llamando la atención.
- Con **compras parciales**, "por debajo" es el estado normal mientras se va comprando; se resalta igual
  porque se pidió ver cualquier diferencia, y al llegar a la cantidad pedida pasa a "completo".
- Las alertas **no se esconden al plegar un rubro**: el encabezado muestra "⚠ N de más" (rojo) y
  "N por debajo" (naranja). El resumen de arriba suma "⚠ N de más" en *Comprados* (`totalesLista` devuelve
  `excedidos`, líneas con más de lo pedido, además de `parciales`).
- No se compara el **precio** con la referencia como alerta (eso sigue siendo el ▲/▼ chico de "Última vez");
  la alerta es sólo por cantidades.

## Cargar el precio como total pagado

En **Registrar compra** el precio se puede tipear de dos maneras
(`CampoPrecio`, un toggle "Por kg | Total pagado"; "Unitario | Total pagado" si la unidad no es g/ml):

- **Unitario**: el precio por unidad (por kg/litro si la unidad es g/ml, como en el resto).
- **Total pagado**: lo que costó esa cantidad. El precio unitario se calcula como
  `total ÷ cantidad` (`precioUnitarioDeEntrada`): **500 g por $2.000 → $4 por g = $4.000 por kg**;
  250 ml por $1.500 → $6.000 por litro. Debajo del campo se ve el resultado en vivo
  ("= $4.000 por kg · $4 por g").

Se guarda **siempre el precio por la unidad de la línea** (el total se descarta: es derivable de
`cantidad × precio`), así que nada del resto —promedio, gastado, referencia— cambia. Con unidad
g/ml el modo arranca en **total pagado** (es lo que dice el ticket); con las demás, en unitario.
Al cambiar de modo con un número ya tipeado, el campo se **convierte** (`entradaDePrecio`, total a
centavos) en vez de reinterpretarlo. En modo total hace falta la cantidad: sin ella no se calcula
(`null`, nunca `Infinity`) y se avisa. Un total de 0 es válido (precio 0).

## Cargar artículos desde una imagen (OCR)

Botón **"Desde imagen"** (escritorio) / icono de cámara (celular) junto a "Unidades y rubros": abre
`ImagenDialog` para cargar varios artículos de una vez desde la foto de una **lista escrita** o de un
**ticket**.

- **El OCR corre en el navegador** con `tesseract.js` (idioma `spa`, import dinámico: sólo se baja al usar la
  función). La imagen **no sale del dispositivo**, no hay API key ni costo. La primera vez descarga el motor y
  los datos del idioma desde CDN (unos MB; después quedan en el navegador). `public/sw.js` no intercepta esos
  hosts (`cdn.jsdelivr.net`, `tessdata.projectnaptha.com`) para no duplicarlos en su caché.
- Antes de reconocer, la imagen se reduce (lado mayor ≤ 2000 px, nunca se agranda) y pasa a escala de grises
  con más contraste. Funciona bien con texto impreso y mal con letra a mano: por eso **siempre hay revisión**.
- **`src/lib/lista-compras-ocr.ts`** (puro, test `lista-compras-ocr.test.ts`): `parseLineasOcr(texto, unidades)`
  → `{ nombre, cantidad, unidad, total }[]`. Entiende `2 kg manzanas`, `2kg manzanas`, `1,5 l de aceite`,
  `manzanas 2 kg`, `leche x2`, `1/2 kg pan`, viñetas y numeración (`- pan`, `1) yerba`) y renglones de ticket:
  el **importe final** (`1.234,50`) es el `total` de la línea y, en un ticket, un `1L` del final es parte del
  nombre (tamaño del producto), no la cantidad; sólo una cantidad explícita (`2 x CAFE`) o al comienzo cuenta.
  Descarta ruido (TOTAL, SUBTOTAL, CUIT, EFECTIVO, VUELTO, fecha…), saca códigos de barras del comienzo, pasa
  el MAYÚSCULAS del ticket a "Primera mayúscula" y **suma los repetidos** (sin distinguir mayúsculas ni
  acentos). La unidad leída (`Kgs.`, `litros`, `gr`…) se resuelve a una unidad que **exista en la tabla**
  (`resolverUnidad`); si no existe queda sin unidad. `precioDeTicket(total, cantidad)` = importe ÷ cantidad
  (precio por la unidad de la línea, el que se guarda en una compra).
- **Se mapea a tus artículos** (`src/lib/lista-compras-match.ts`, test `lista-compras-match.test.ts`):
  `mejorCoincidencia(textoLeído, catálogo)` elige el artículo propio que mejor describe la línea leída
  (`Afeitadora Gillette Prestoarba3 2 Unidades La` → "Afeitadora"; `MEX Anicar Blanco Ledesma… kg E` →
  "Azúcar"). Mide qué porción de las **palabras del artículo** aparece en lo leído (el artículo propio es
  corto y la línea trae marca, tamaño y ruido), sin acentos/mayúsculas, con prefijos (leche ~ leches) y
  tolerancia a letras que el OCR confunde (sólo palabras de ≥ 5 letras). Mínimo 0,6; desempata por más palabras
  coincidentes y luego nombre más corto. El texto leído se **conserva** y se muestra debajo ("Leído: …").
- **Revisión editable:** una fila por línea con casilla, artículo (autocompletar sobre el catálogo; se puede
  corregir o escribir uno nuevo), cantidad, unidad y rubro. Al mapear/elegir un artículo propio se **precargan
  su unidad, rubro y la última cantidad usada** (`ArticuloCatalogo.ultima_cantidad`: cantidad de su línea más
  reciente, `ultimosDeArticulo`; el catálogo lo expone junto a `ultimo_precio`); unidad y rubro quedan fijos
  mientras sea un artículo propio. Lo que no coincide con nada llega **destildado** ("Sin coincidencia") y, si se
  confirma, se crea como artículo nuevo. Dos renglones del mismo artículo se funden en una fila.
- **Precio por fila**, igual que al registrar una compra (`CampoPrecio`): se carga como **precio unitario**
  (por kg/litro si la unidad es g/ml) o como **total pagado** (`precioUnitarioDeEntrada`: total ÷ cantidad), con el
  resultado en vivo debajo y conversión al cambiar de modo. Si el ticket trae el importe de la línea llega
  precargado como "total pagado"; si no, queda vacío y se tipea a mano (opcional: sin precio la compra suma
  cantidad pero no entra al promedio). La fecha es una sola para toda la imagen.
- **Qué hace cada fila** (chip de estado): si el artículo **ya está en la lista del mes** se registra una
  **compra** (cantidad, precio y fecha de arriba); si no, se da de **alta** con la última cantidad y, **si tiene
  precio, se registra además la compra** (misma cantidad). `fechaDeTicket(texto, hoy)` toma la primera fecha real
  y no futura del ticket (`dd/mm/aaaa`, `dd-mm-aa`, `dd.mm.aaaa`), con hoy como fallback; es editable en el diálogo.
- El diálogo entrega « altas » y « compras » (`ImportItem`) a `importarDeImagen` de la página: `agregar(input, false)` y
  `guardarCompra(..., false)` no recargan en cada uno; se recarga una sola vez al final. `agregar` ahora devuelve la línea creada (o
  `null`), no un boolean. No hay endpoint nuevo ni migración.

## Cargar varias compras del mismo día

Botón **"Varias compras"** (escritorio) / icono `PlaylistAdd` (celular), junto a "Desde imagen": abre el
**mismo `ImagenDialog`** con `origen="manual"`, que salta el OCR y arranca directo en la **revisión** con una
fila vacía y la fecha de hoy. Es la carga desde imagen sin la imagen: una sola fecha para todas las filas y
el mismo destino por fila (compra si el artículo ya está en la lista del mes, alta si no).

- **"Agregar otro artículo"** suma una fila (con el foco en el artículo); cada fila tiene un botón para
  **quitarla** en lugar de la casilla de incluir. Las filas sin artículo ni cantidad **se ignoran** (no se
  marcan como error), así sobra una vacía al final sin molestar.
- **Al elegir un artículo propio** se precarga como en "Registrar compra" (`precargaCompra` en
  `lista-compras-compute.ts`, compartida con `CompraDialog`): si ya está en la lista, **lo que falta**
  (o lo pedido, si ya se completó) y el último precio conocido (promedio del mes → referencia → último
  precio del artículo); si no está, su última cantidad y su último precio. Unidad y rubro quedan fijos. El
  precio arranca en "total pagado" con g/ml y en unitario con las demás. Volver a elegir el mismo artículo
  (el blur del autocompletar lo re-dispara) **no pisa** lo tipeado (`Fila.precargadoDe`).
- **Diferencia con la imagen:** lo que **no está en la lista del mes** se da de alta **y se registra la compra
  aunque no tenga precio** (`ImportItem` alta con `comprar: true`): todo lo cargado acá ya se compró. Desde
  imagen, en cambio, un alta sin precio queda como pendiente (puede ser una lista escrita). Un nombre que no es
  un artículo propio se crea como nuevo (unidad "un" por default, editable).
- Mismo `importarDeImagen` de la página (una sola recarga al final y toast con altas/compras). No hay endpoint
  nuevo ni migración.

## Mobile

Debajo del breakpoint `md` (900px) la página pasa a un diseño **compacto** (`useMediaQuery`); arriba
queda el de escritorio, sin cambios. La fila vive en `FilaLista.tsx` (`FilaEscritorio` /
`FilaCompacta`, que comparten el hook `useCamposFila` con el estado local de los campos y sus
guardados, así que no se pueden desincronizar).

- **Fila compacta** (con compras registradas se ocultan los −/+ y "Llevo" queda de sólo lectura): apilada a ancho completo, con áreas de toque de 40px (tilde, borrar, +/−) y
  campos de 56px. **Lo llevado** tiene botones **−/+** (`ajustarLlevo`: paso 1, o 100 si la unidad
  es g/ml; nunca baja de 0; guarda al toque) además del campo editable. **Necesito** y **precio**
  van en dos columnas, debajo los dos **precios por unidad** (individual y mayor) lado a lado, y el
  total abajo a la derecha. **Nombre, rubro y unidad** quedan plegados detrás del lápiz del nombre
  (casi nunca se tocan), con el nombre a ancho completo y rubro/unidad en dos columnas.
- **Resumen**: un único cuadro de tres renglones en vez de tres tarjetas.
- **Agregar artículo** en el celular **no es un formulario en la página sino un diálogo a pantalla
  completa**, que se abre con el botón de la tarjeta de arriba o con un **botón flotante "+" fijo** abajo a la
  derecha (`Fab`, respeta el área segura del teléfono). El flotante resuelve el caso de estar al final de
  una lista larga: se agrega sin subir hasta el principio y sin perder el lugar en la lista. Adentro, campos a
  ancho completo con cantidad y unidad juntas en un renglón y botón grande. **El diálogo queda abierto** al agregar
  (avisa "Agregado: X", limpia el nombre y devuelve el foco para cargar el siguiente); "Listo" o la X lo
  cierran. Al abrirlo el foco va al nombre. La página deja margen abajo para que el flotante no tape los
  botones de la última fila. En escritorio el formulario sigue inline en la tarjeta (es el mismo
  `formularioAlta`, montado en un lugar u otro según el tamaño, con el estado en la página).
- **Quitar de este mes pide confirmación** (en todos los tamaños): un toque accidental con el
  pulgar no debería borrar la línea. El artículo y su historial de precios se conservan.
- **Administrar unidades y rubros** abre a **pantalla completa** y sus filas se parten en dos
  renglones (el selector de equivalencia pasa abajo).
