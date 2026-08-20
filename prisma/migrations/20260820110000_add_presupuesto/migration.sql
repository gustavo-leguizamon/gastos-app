-- Presupuesto mensual por categoría. La app mostraba montos absolutos pero nada contra qué
-- compararlos: no había forma de responder "¿me pasé en Comida este mes?".
--
-- Es por (categoría, mes, año) y no un default que se arrastra, para que cambiar el
-- presupuesto de un mes no reescriba la historia de los meses ya cerrados. La ausencia de
-- fila significa "sin presupuesto", que no es lo mismo que un presupuesto en 0.
--
-- `onDelete: Cascade` desde la categoría: un presupuesto de una categoría borrada no
-- significa nada. (En la práctica no se puede borrar una categoría en uso, pero una sin uso
-- sí, y podría tener presupuesto cargado.)

-- CreateTable
CREATE TABLE "Presupuesto" (
    "id" SERIAL NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Presupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Presupuesto_categoriaId_mes_anio_key" ON "Presupuesto"("categoriaId", "mes", "anio");

-- CreateIndex
CREATE INDEX "Presupuesto_anio_mes_idx" ON "Presupuesto"("anio", "mes");

-- AddForeignKey
ALTER TABLE "Presupuesto" ADD CONSTRAINT "Presupuesto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
