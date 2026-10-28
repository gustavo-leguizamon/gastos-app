-- Promociones de reintegro recurrentes (lugar, %, tope mensual, días, tarjetas/efectivo).
-- Es una regla que se repite todos los meses: no hay fila por período. El consumo y el
-- reintegro del mes se calculan, no se guardan. Sólo se persiste lo que no es derivable:
-- los usos cargados a mano.
--
-- Cambio puramente aditivo (tablas nuevas): el código viejo no las conoce y no se rompe.

-- CreateTable
CREATE TABLE "Promocion" (
    "id" SERIAL NOT NULL,
    "lugar" TEXT NOT NULL,
    "conceptoId" INTEGER,
    "porcentaje" DOUBLE PRECISION NOT NULL,
    "topeMensual" DOUBLE PRECISION NOT NULL,
    "dias" INTEGER[],
    "efectivo" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promocion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromocionUso" (
    "id" SERIAL NOT NULL,
    "promocionId" INTEGER NOT NULL,
    "fecha" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "montoGasto" DOUBLE PRECISION NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromocionUso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PromocionTarjetas" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "PromocionUso_promocionId_anio_mes_idx" ON "PromocionUso"("promocionId", "anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "_PromocionTarjetas_AB_unique" ON "_PromocionTarjetas"("A", "B");

-- CreateIndex
CREATE INDEX "_PromocionTarjetas_B_index" ON "_PromocionTarjetas"("B");

-- AddForeignKey
ALTER TABLE "Promocion" ADD CONSTRAINT "Promocion_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "Concepto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromocionUso" ADD CONSTRAINT "PromocionUso_promocionId_fkey" FOREIGN KEY ("promocionId") REFERENCES "Promocion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PromocionTarjetas" ADD CONSTRAINT "_PromocionTarjetas_A_fkey" FOREIGN KEY ("A") REFERENCES "Promocion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PromocionTarjetas" ADD CONSTRAINT "_PromocionTarjetas_B_fkey" FOREIGN KEY ("B") REFERENCES "Tarjeta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
