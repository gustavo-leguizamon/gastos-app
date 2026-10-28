-- Asociación explícita gasto → promoción y vigencia de la promoción.
--
-- Antes el consumo de una promo se calculaba con TODOS los gastos del mes del concepto
-- vinculado, lo que cuenta mal una promo que arranca a mitad de mes (el gasto no guarda fecha
-- de compra, así que no se puede filtrar por fecha). Ahora cuenta sólo lo asociado
-- explícitamente. `ON DELETE SET NULL`: borrar la promo desasocia, no borra gastos.
--
-- Cambio aditivo (columnas nullable): el código viejo no las conoce y no se rompe.

-- AlterTable
ALTER TABLE "Promocion" ADD COLUMN "vigenteDesde" TEXT,
ADD COLUMN "vigenteHasta" TEXT;

-- AlterTable
ALTER TABLE "Gasto" ADD COLUMN "promocionId" INTEGER;

-- CreateIndex
CREATE INDEX "Gasto_promocionId_idx" ON "Gasto"("promocionId");

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_promocionId_fkey" FOREIGN KEY ("promocionId") REFERENCES "Promocion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
