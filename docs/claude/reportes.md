# Reportes (gráficos + filtros sobre gastos)

Sección standalone (`/reportes`, desde `TopBar` → `NAV`, icono `BarChartIcon`) para visualizar métricas de gastos con filtros. Toda la agregación es **server-side** en un módulo puro testeable; el cliente sólo pinta.

## Endpoint `GET /api/reportes`

Params (todos snake_case):
- **Rango (obligatorio):** `mes_desde`, `anio_desde`, `mes_hasta`, `anio_hasta`. Faltando alguno → 400.
- `casa_id` — single (opcional).
- `tipo_pago` — `'C'` / `'D'` (opcional).
- `categoria_ids`, `tarjeta_ids`, `concepto_ids` — listas `"1,2,3"` (opcionales).
- `incluir_tarjetas` — `"true"` para **no** excluir los gastos `esTarjeta` (ver abajo). Default: se excluyen.
- `top` — límite del ranking de conceptos (default 12, acotado 1–50).

El `where` se arma: `OR` de los `{mes,anio}` de la ventana (`enumerateMonths`), `esTarjeta: false` (salvo `incluir_tarjetas`), + filtros mapeados a camelCase (`casaId`, `tipoPago`, `categorias: { some: { id: { in } } }`, `tarjetaId: { in }`, `conceptoId: { in }`). Include: `categorias`, `concepto`, `items`, `tarjeta`.

Response (`Reporte` en `types.ts`):
```
{ kpis: { total, promedio_mensual, cantidad_gastos, meses },
  por_categoria: { id, nombre, total_ars }[],       // desc por total; id null = "Sin categoría"
  por_mes:       { mes, anio, label, total_ars }[],  // cronológico, 0 en meses sin gastos
  top_conceptos: { concepto_id, nombre, total_ars }[], // desc, hasta `top`
  por_tarjeta:   { id, nombre, total_ars }[],        // desc; id null = "Sin tarjeta" (débito/efectivo)
  por_tipo_pago: { tipo, nombre, total_ars }[] }     // desc; tipo 'C'/'D', nombre "Crédito"/"Débito"
```

## Lógica pura (`src/lib/reportes-compute.ts`)

Sin imports de Prisma/Next (testeable). Importado por la route. Test: `reportes-compute.test.ts`.

- **`enumerateMonths(mesDesde, anioDesde, mesHasta, anioHasta)`** — lista cronológica inclusive de `{mes,anio}`. Endereza rangos invertidos y acota a **60 meses** (recorta desde el inicio).
- **`computeReportes(gastos, months, { topConceptos })`** — agrega las dimensiones (categoría, mes, conceptos, tarjeta, tipo de pago) + KPIs.

**Métrica `total_ars` por gasto:** misma definición que `/api/gastos/evolucion` — si `!confirmado` y hay sub-items, suma de items `incluyeEnTotal`; si no, `totalMoneda × tipoCambio`. Admite negativos (devoluciones).

**Decisiones de producto:**
- **Atribución por categoría:** un gasto con N categorías suma su total **completo** a cada categoría ("cuánto tocó la categoría X"). Por eso la suma de categorías puede superar el `total` de KPIs (que cuenta cada gasto una sola vez). Gastos sin categorías → bucket **"Sin categoría"** (`id: null`).
- **Doble-conteo de tarjeta:** los gastos `esTarjeta` (resúmenes contenedores) se **excluyen por defecto**, porque los consumos ya existen como gastos individuales. `incluir_tarjetas=true` los incluye.
- **Promedio mensual** = `total / meses` (meses del rango, no meses con datos).

## UI (`src/app/reportes/page.tsx`)

Carga las opciones de filtros una vez (`/api/casas`, `/api/categorias`, `/api/tarjetas`, `/api/conceptos`) y re-consulta `/api/reportes` en cada cambio de filtros **o de vista** (con `AbortController` para descartar respuestas viejas). Default: preset "Últimos 6".

**Vistas (submenú, `Tabs`)** — array `VISTAS` en la page (extensible: agregar una entrada suma un tab). Cada vista define `incluirTarjetas`, que se pasa como `incluir_tarjetas` al endpoint:
- **"Gastos individuales"** (`incluirTarjetas: false`, default) — excluye los resúmenes de tarjeta (evita doble-conteo). Mejor detalle por categoría/concepto. Total ≈ gastos individuales.
- **"Total con tarjetas"** (`incluirTarjetas: true`) — incluye los resúmenes de tarjeta; el total coincide con el "Total Gastos" de la pantalla de Gastos. El consumo de tarjeta (resúmenes sin categoría) puede caer en "Sin categoría" y sus conceptos son los nombres de tarjeta.

Debajo de los tabs se muestra un caption explicando la vista activa. Los filtros y los charts son los mismos para ambas vistas; sólo cambia el universo de gastos.

- **`ReportesFiltros`** — presets de período (`ToggleButtonGroup`: Este mes / Últimos 3 / 6 / 12 / Este año / Personalizado). `presetRange(preset)` calcula el rango relativo al mes actual **local**. "Personalizado" muestra pickers mes+año desde/hasta (`AppSelect`). Debajo: `AppMultiSelect` de Categorías / Tarjetas / Conceptos, `AppSelect` Casa (emptyLabel "Todas"), `ToggleButtonGroup` Tipo de pago.
- **`ReporteKpis`** — 4 stat tiles (Total gastado, Promedio mensual, Cantidad de gastos, Meses analizados).
- **`ReporteCategoriaChart`** — donut (`PieChart` de `@mui/x-charts`) con leyenda propia (swatch + nombre + monto + %). Sólo montos positivos; hasta 8 slices, el excedente se agrupa en "Otras". Colores de la paleta categórica dark validada (`vizConfig.ts`); "Sin categoría"/"Otras" usan tonos neutros para no impersonar un slot.
- **`ReporteMensualChart`** — `BarChart` vertical, serie única (Total ARS por mes).
- **`ReporteTipoPagoChart`** — donut de 2 slices (Crédito slot blue / Débito slot aqua, color estable por tipo).
- **`ReporteConceptosChart`** / **`ReporteTarjetaChart`** — rankings horizontales (top conceptos / gasto por tarjeta, incluye "Sin tarjeta").

**Componentes genéricos reusables** (extraídos para no duplicar):
- **`ReporteDonutChart`** — donut + leyenda propia (swatch + nombre + monto + %). Recibe los slices con color ya resuelto. Lo usan categoría y tipo de pago.
- **`ReporteRankingChart`** — barras horizontales de `{ label, total_ars }` (sólo positivos, mayor arriba, alto dinámico). Lo usan conceptos y tarjeta.

`src/components/reportes/vizConfig.ts` centraliza la paleta categórica (columna dark de la paleta del skill dataviz, orden CVD-safe — no reordenar sin re-validar), tonos neutros, y los formatters `fmtARS` / `fmtARSCompact` (ejes).

## Tests

- `reportes-compute.test.ts` — `enumerateMonths` (rango, wraparound, invertido, cap 60) y `computeReportes` (total/promedio, tipoCambio, atribución completa por categoría, "Sin categoría", agregación por mes con ceros, ranking de conceptos + límite, por tarjeta con "Sin tarjeta", por tipo de pago, no-confirmado con items).
- `src/app/api/reportes/route.test.ts` — 400 sin rango, armado del `where` (OR meses, `esTarjeta:false`), mapeo de filtros snake→camel, `incluir_tarjetas`, y forma del response agregado (mock de Prisma).
