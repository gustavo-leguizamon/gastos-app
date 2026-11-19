-- Día de reinicio del tope (default 1 = mes calendario: las promos existentes no cambian).
ALTER TABLE "Promocion" ADD COLUMN "diaReinicio" INTEGER NOT NULL DEFAULT 1;

-- Fecha de compra con la promo: a qué ciclo cuenta el gasto. Nullable (los ya asociados caen en su mes).
ALTER TABLE "Gasto" ADD COLUMN "promocionFecha" TEXT;

-- Usos del saldo a favor (lo ya reintegrado).
CREATE TABLE "PromocionSaldoUso" (
    "id" SERIAL NOT NULL,
    "promocionId" INTEGER NOT NULL,
    "fecha" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromocionSaldoUso_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromocionSaldoUso_promocionId_idx" ON "PromocionSaldoUso"("promocionId");

ALTER TABLE "PromocionSaldoUso" ADD CONSTRAINT "PromocionSaldoUso_promocionId_fkey" FOREIGN KEY ("promocionId") REFERENCES "Promocion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
