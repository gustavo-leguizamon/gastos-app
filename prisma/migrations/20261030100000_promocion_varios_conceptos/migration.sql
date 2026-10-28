-- Una promoción puede vincularse a varios conceptos (antes, uno solo en Promocion.conceptoId).
-- Tabla puente M2M implícita de Prisma ("A" = Concepto, "B" = Promocion, por orden alfabético).
--
-- Cambio aditivo: la columna "conceptoId" se conserva (legacy, ya no se lee ni se escribe) para
-- no romper el código que todavía corre en producción contra esta misma base. Sólo se suelta
-- su FK, porque Prisma ya no modela esa relación.

-- CreateTable
CREATE TABLE "_PromocionConceptos" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_PromocionConceptos_AB_unique" ON "_PromocionConceptos"("A", "B");

-- CreateIndex
CREATE INDEX "_PromocionConceptos_B_index" ON "_PromocionConceptos"("B");

-- AddForeignKey
ALTER TABLE "_PromocionConceptos" ADD CONSTRAINT "_PromocionConceptos_A_fkey" FOREIGN KEY ("A") REFERENCES "Concepto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PromocionConceptos" ADD CONSTRAINT "_PromocionConceptos_B_fkey" FOREIGN KEY ("B") REFERENCES "Promocion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: el concepto que ya tenían vinculado pasa a la tabla puente.
INSERT INTO "_PromocionConceptos" ("A", "B")
SELECT "conceptoId", "id" FROM "Promocion" WHERE "conceptoId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- DropForeignKey (la columna queda como legacy, sin relación)
ALTER TABLE "Promocion" DROP CONSTRAINT "Promocion_conceptoId_fkey";
