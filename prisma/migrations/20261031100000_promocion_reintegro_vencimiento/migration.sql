-- Vencimiento del reintegro de una promoción en un mes puntual (la fecha se carga a mano: varía
-- entre meses y entre promos). Una fila por (promoción, mes, año); `utilizado` apaga los avisos.
--
-- Cambio puramente aditivo (tabla nueva): el código viejo no la conoce y no se rompe.

-- CreateTable
CREATE TABLE "PromocionReintegro" (
    "id" SERIAL NOT NULL,
    "promocionId" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "venceEl" TEXT,
    "utilizado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromocionReintegro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromocionReintegro_promocionId_mes_anio_key" ON "PromocionReintegro"("promocionId", "mes", "anio");

-- AddForeignKey
ALTER TABLE "PromocionReintegro" ADD CONSTRAINT "PromocionReintegro_promocionId_fkey" FOREIGN KEY ("promocionId") REFERENCES "Promocion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
