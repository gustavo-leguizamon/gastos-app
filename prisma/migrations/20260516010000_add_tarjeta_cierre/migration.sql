-- CreateTable
CREATE TABLE "TarjetaCierre" (
    "id" SERIAL NOT NULL,
    "tarjetaId" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "fechaCierre" TEXT,
    "fechaVencimiento" TEXT,
    "fechaProximoCierre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarjetaCierre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TarjetaCierre_tarjetaId_mes_anio_key" ON "TarjetaCierre"("tarjetaId", "mes", "anio");

-- AddForeignKey
ALTER TABLE "TarjetaCierre" ADD CONSTRAINT "TarjetaCierre_tarjetaId_fkey" FOREIGN KEY ("tarjetaId") REFERENCES "Tarjeta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill TarjetaCierre from existing "resumen de tarjeta" gastos.
-- For each (tarjetaId, mes, anio) combination present in Gasto with esTarjeta=true,
-- pick the lowest id row and copy its fechaCierre/fechaVencimiento/fechaProximoCierre.
INSERT INTO "TarjetaCierre" ("tarjetaId", "mes", "anio", "fechaCierre", "fechaVencimiento", "fechaProximoCierre", "updatedAt")
SELECT DISTINCT ON ("tarjetaId", "mes", "anio")
    "tarjetaId", "mes", "anio", "fechaCierre", "fechaVencimiento", "fechaProximoCierre", CURRENT_TIMESTAMP
FROM "Gasto"
WHERE "esTarjeta" = true AND "tarjetaId" IS NOT NULL
ORDER BY "tarjetaId", "mes", "anio", "id" ASC;

-- Drop the columns from Gasto (data has been migrated above)
ALTER TABLE "Gasto" DROP COLUMN "fechaCierre";
ALTER TABLE "Gasto" DROP COLUMN "fechaProximoCierre";
