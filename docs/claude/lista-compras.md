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
- **Precio por kg / litro (unidades g y ml)**: `Unidad.subunidadDe` (`'kg'` | `'l'` | null) marca
  que la unidad es **la milésima parte** de kg o litro (g → kg, ml → l; `FACTOR_SUBUNIDAD = 1000`).
  Cuando el artículo usa una unidad así, el precio **se carga y se ve por kg/litro** (campo
  "Precio por kg") pero **se persiste siempre por la unidad de la línea** (`precioUnitario` por
  gramo): así el total (`cantidad × precio`), `gastado`, `estimado`, la referencia y la
  variación no cambian ni necesitan saber de conversiones. 500 g a $4.000/kg → se guarda $4 por g
  → total $2.000. La pantalla muestra el precio por g/ml como aclaración ("= $4 por g"). La
  conversión es de presentación: `aPrecioBase` / `desdePrecioBase` (con redondeo a 6 decimales
  para no mostrar `3999.9900000000002`), usadas por el cliente; la API sigue hablando en precio
  por unidad de la línea y sólo agrega `subunidad_de` a cada ítem.
  - Al **crear** una unidad la equivalencia se **infiere del nombre** (`inferirSubunidad`: g, gr,
    grs, gramo(s) → kg; ml, cc, mililitro(s) → l; sin acentos ni mayúsculas ni puntos). Cualquier
    otro nombre queda sin equivalencia y se puede fijar a mano en "Administrar unidades y rubros"
    (select "Equivale a 1/1000 de").
  - Cambiar la equivalencia (o la unidad de un artículo) **no reconvierte** precios ya guardados:
    cambia cómo se interpretan/muestran, así que conviene hacerlo antes de cargar precios.
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
`comprado` derivado y `total_llevado` = llevado × precio), `totalesLista`:

- `estimado` = Σ `cantidad × (precio del mes ?? precio de referencia)`.
- `gastado` = Σ `cantidad_comprada × precio` (lo que **ya se compró**) en las líneas con precio
  cargado: un precio sin nada llevado todavía no suma al gastado, sí al estimado.
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
- **Buscador** arriba de la lista ("Buscar artículo o rubro"; Esc o la X lo limpian). Filtra mientras se
  escribe con `coincideBusqueda`: ignora mayúsculas y acentos (`normalizarBusqueda`) y **todas las
  palabras** tienen que aparecer, en cualquier orden y aunque sean parte de una palabra, en el nombre
  **o en el rubro** ("yer" → Yerba mate; "alm yer" → Yerba del rubro Almacén). Se ocultan los rubros
  sin coincidencias, los que tienen alguna se muestran **desplegados aunque estén plegados** (con
  el encabezado sin interacción mientras se busca, y "N de M" además del resumen), y se oculta
  "Colapsar todos". Debajo se ve "N de M artículos" o "Ningún artículo coincide con «x»". Los
  totales de arriba (estimado, gastado, comprados) **no se filtran**: son los del mes. Lo escrito no se
  recuerda al recargar.
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
  campo de **precio por kg/litro** cuando la unidad es g/ml (con "= $X por g" y la referencia también por kg/l),
  campo **Llevo** (acumulado, se actualiza en cada compra) junto a **Necesito**, "llevo $X" bajo
  el total cuando es parcial,
  referencia ("Última vez: $X × cant (mm/aaaa) ▲/▼ %" — el % sólo si hay precio este mes),
  **rubro y unidad** (mismos `CatalogoSelect`; son del artículo, así que el cambio vale para todos los meses y, al cambiar el rubro, la fila se mueve de grupo; el rubro se puede quitar), cantidad y precio editables inline (se guardan al salir del campo / Enter; el placeholder
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
  simple daría $1.050). Es lo correcto porque `cantidad × promedio` **coincide con lo realmente
  pagado**, así que `gastado` no se desvía; con promedio simple pesaría igual una compra de 1 u
  que una de 9. Las compras sin precio suman cantidad pero no entran al promedio.
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

## Mobile

Debajo del breakpoint `md` (900px) la página pasa a un diseño **compacto** (`useMediaQuery`); arriba
queda el de escritorio, sin cambios. La fila vive en `FilaLista.tsx` (`FilaEscritorio` /
`FilaCompacta`, que comparten el hook `useCamposFila` con el estado local de los campos y sus
guardados, así que no se pueden desincronizar).

- **Fila compacta** (con compras registradas se ocultan los −/+ y "Llevo" queda de sólo lectura): apilada a ancho completo, con áreas de toque de 40px (tilde, borrar, +/−) y
  campos de 56px. **Lo llevado** tiene botones **−/+** (`ajustarLlevo`: paso 1, o 100 si la unidad
  es g/ml; nunca baja de 0; guarda al toque) además del campo editable. **Necesito** y **precio**
  van en dos columnas y el total abajo a la derecha. **Rubro y unidad** quedan plegados detrás de
  "Rubro · unidad ✎" (casi nunca se tocan).
- **Resumen**: un único cuadro de tres renglones en vez de tres tarjetas.
- **Agregar artículo** arranca **plegado** en el celular (la lista es lo que más se usa); adentro,
  campos a ancho completo con cantidad y unidad juntas en un renglón y botón grande.
- **Quitar de este mes pide confirmación** (en todos los tamaños): un toque accidental con el
  pulgar no debería borrar la línea. El artículo y su historial de precios se conservan.
- **Administrar unidades y rubros** abre a **pantalla completa** y sus filas se parten en dos
  renglones (el selector de equivalencia pasa abajo).
