-- El movimiento de una inversión pasa a tener descripción: un depósito o retiro se veía
-- sólo como un número, sin nada que dijera por qué se cargó ("aporte mensual", "retiro
-- para el auto", "rescate parcial").
--
-- Nullable y sin backfill: los movimientos ya cargados no tienen motivo y no hay ninguno
-- que inventarles. `null` significa "no lo aclaró", distinto de un texto vacío.

-- AlterTable
ALTER TABLE "Movimiento" ADD COLUMN "descripcion" TEXT;
