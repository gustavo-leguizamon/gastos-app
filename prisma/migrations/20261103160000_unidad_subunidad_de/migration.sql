-- Una unidad puede ser la milésima parte de otra base: g es 1/1000 de kg, ml es 1/1000 de l.
-- Con eso la lista de compras muestra y carga el precio por kg / por litro cuando se compra
-- en gramos o mililitros. NULL = no tiene equivalencia (un, kg, l, pack...).

-- AlterTable
ALTER TABLE "Unidad" ADD COLUMN "subunidadDe" TEXT;

-- Las que ya existen con nombres obvios.
UPDATE "Unidad" SET "subunidadDe" = 'kg' WHERE lower("nombre") IN ('g', 'gr', 'grs', 'gramo', 'gramos');
UPDATE "Unidad" SET "subunidadDe" = 'l' WHERE lower("nombre") IN ('ml', 'mls', 'cc', 'mililitro', 'mililitros');
