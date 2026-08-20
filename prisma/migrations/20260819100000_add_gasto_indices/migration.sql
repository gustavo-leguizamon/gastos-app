-- Índices de `Gasto`. La tabla no tenía ninguno más allá de la PK: ni el período
-- (que filtra la grilla, el resumen, la evolución, los reportes y el cron) ni la FK
-- de concepto (Postgres no indexa foreign keys automáticamente), así que cada query
-- era un seq scan que empeora a medida que crece el histórico.
--
-- CONCURRENTLY no se usa a propósito: requiere correr fuera de transacción y la tabla
-- es chica (cientos de filas), así que el lock momentáneo no se nota.

-- CreateIndex
CREATE INDEX "Gasto_anio_mes_casaId_idx" ON "Gasto"("anio", "mes", "casaId");

-- CreateIndex
CREATE INDEX "Gasto_conceptoId_idx" ON "Gasto"("conceptoId");
