-- Objetivo de ahorro del mes: el monto que se quiere que sobre, del que se derivan los topes
-- por categoría. Hasta ahora los presupuestos se cargaban uno por uno a ojo y nada ataba su
-- suma a una meta.
--
-- Se guardan también los supuestos con los que se generó (ingresos esperados, base de
-- medición, meses de histórico): sin ellos no se puede recalcular después ni explicar de
-- dónde salió cada tope. Los ingresos esperados no son derivables de `Ingreso` — al
-- presupuestar un mes que todavía no arrancó no hay ninguno cargado.
--
-- Uno por (mes, año): es la meta del período, no una por categoría.

-- CreateTable
CREATE TABLE "ObjetivoAhorro" (
    "id" SERIAL NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "ingresosEsperados" DOUBLE PRECISION NOT NULL,
    "base" TEXT NOT NULL DEFAULT 'devengado',
    "mesesHistorico" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObjetivoAhorro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ObjetivoAhorro_mes_anio_key" ON "ObjetivoAhorro"("mes", "anio");

-- El tope que el reparto automático no debe tocar: la categoría marcada como gasto fijo o la
-- que se ajustó a mano después de generar. Default `false` — los topes ya cargados se
-- generaron a mano, pero ninguno participó todavía de un reparto, así que arrancan libres.

-- AlterTable
ALTER TABLE "Presupuesto" ADD COLUMN "fijado" BOOLEAN NOT NULL DEFAULT false;
