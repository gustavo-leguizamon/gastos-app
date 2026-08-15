-- Los ingresos pasan a soportar moneda, con el mismo mecanismo que `Gasto`:
-- `montoMoneda * tipoCambio` = monto en ARS. Lo ya cargado era ARS, así que el rename
-- conserva el valor y el backfill lo deja en ARS con tipo de cambio 1 (equivalente exacto).

-- AlterTable
ALTER TABLE "Ingreso" RENAME COLUMN "monto" TO "montoMoneda";

ALTER TABLE "Ingreso" ADD COLUMN "tipoCambio" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- La columna se agrega nullable y se backfillea antes de exigir NOT NULL, para no fallar
-- si ya hay filas cargadas.
ALTER TABLE "Ingreso" ADD COLUMN "monedaId" INTEGER;

UPDATE "Ingreso"
SET "monedaId" = (SELECT "id" FROM "Moneda" WHERE "codigo" = 'ARS' ORDER BY "id" LIMIT 1)
WHERE "monedaId" IS NULL;

ALTER TABLE "Ingreso" ALTER COLUMN "monedaId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Ingreso" ADD CONSTRAINT "Ingreso_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "Moneda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
