-- Preferencia de visualización de un artículo en g/ml: ver (y cargar por defecto) las cantidades
-- en kg/l. Es sólo de presentación: las cantidades se siguen guardando en g/ml.
-- Aditiva con default: el código que no la conoce la ignora.

-- AlterTable
ALTER TABLE "Articulo" ADD COLUMN "mostrarEnMultiplo" BOOLEAN NOT NULL DEFAULT false;
