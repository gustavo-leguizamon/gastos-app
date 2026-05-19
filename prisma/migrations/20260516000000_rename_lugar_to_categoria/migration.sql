-- Rename table Lugar -> Categoria
ALTER TABLE "Lugar" RENAME TO "Categoria";
ALTER TABLE "Categoria" RENAME CONSTRAINT "Lugar_pkey" TO "Categoria_pkey";
ALTER SEQUENCE "Lugar_id_seq" RENAME TO "Categoria_id_seq";

-- Rename column lugarId -> categoriaId on Gasto and its FK constraint
ALTER TABLE "Gasto" RENAME COLUMN "lugarId" TO "categoriaId";
ALTER TABLE "Gasto" RENAME CONSTRAINT "Gasto_lugarId_fkey" TO "Gasto_categoriaId_fkey";

-- Rename column lugarId -> categoriaId on GastoItem and its FK constraint
ALTER TABLE "GastoItem" RENAME COLUMN "lugarId" TO "categoriaId";
ALTER TABLE "GastoItem" RENAME CONSTRAINT "GastoItem_lugarId_fkey" TO "GastoItem_categoriaId_fkey";
