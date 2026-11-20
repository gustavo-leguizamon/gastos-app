-- Promos de monto fijo con compra mínima. Las existentes quedan como `porcentaje`.
ALTER TABLE "Promocion" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'porcentaje';
ALTER TABLE "Promocion" ADD COLUMN "montoReintegro" DOUBLE PRECISION;
ALTER TABLE "Promocion" ADD COLUMN "compraMinima" DOUBLE PRECISION;
