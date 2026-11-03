-- Compras parciales: en vez de un sí/no ("comprado"), se guarda CUÁNTO se lleva comprado de cada
-- línea. "Comprado" pasa a derivarse (cantidadComprada >= cantidad), así no hay dos datos que
-- puedan contradecirse al cambiar la cantidad. Lo ya marcado como comprado se convierte en
-- "llevo todo" (cantidadComprada = cantidad) antes de borrar la columna.

-- AlterTable
ALTER TABLE "ListaCompraItem" ADD COLUMN "cantidadComprada" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "ListaCompraItem" SET "cantidadComprada" = "cantidad" WHERE "comprado" = true;

ALTER TABLE "ListaCompraItem" DROP COLUMN "comprado";
