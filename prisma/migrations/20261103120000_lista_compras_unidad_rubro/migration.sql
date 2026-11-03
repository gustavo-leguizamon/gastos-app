-- Unidad y rubro de los artículos pasan de texto libre a tablas propias (se elige de las
-- existentes o se agrega una nueva). Convierte lo ya cargado: cada texto distinto (sin
-- distinguir mayúsculas) se vuelve una fila y el artículo apunta a ella.

-- CreateTable
CREATE TABLE "Unidad" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rubro" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rubro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unidad_nombre_key" ON "Unidad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Rubro_nombre_key" ON "Rubro"("nombre");

-- Unidades habituales de arranque + las que ya se usaron.
INSERT INTO "Unidad" ("nombre") VALUES ('un'), ('kg'), ('g'), ('l'), ('ml'), ('pack');

INSERT INTO "Unidad" ("nombre")
SELECT MIN(a."unidad") FROM "Articulo" a
WHERE NOT EXISTS (SELECT 1 FROM "Unidad" u WHERE lower(u."nombre") = lower(a."unidad"))
GROUP BY lower(a."unidad");

INSERT INTO "Rubro" ("nombre")
SELECT MIN(a."rubro") FROM "Articulo" a
WHERE a."rubro" IS NOT NULL
GROUP BY lower(a."rubro");

-- AlterTable: columnas nuevas, backfill, y recién después se sacan las de texto.
ALTER TABLE "Articulo" ADD COLUMN "unidadId" INTEGER, ADD COLUMN "rubroId" INTEGER;

UPDATE "Articulo" a SET "unidadId" = (SELECT u."id" FROM "Unidad" u WHERE lower(u."nombre") = lower(a."unidad"));
UPDATE "Articulo" a SET "rubroId" = (SELECT r."id" FROM "Rubro" r WHERE lower(r."nombre") = lower(a."rubro"))
WHERE a."rubro" IS NOT NULL;

ALTER TABLE "Articulo" ALTER COLUMN "unidadId" SET NOT NULL;
ALTER TABLE "Articulo" DROP COLUMN "unidad", DROP COLUMN "rubro";

-- AddForeignKey
ALTER TABLE "Articulo" ADD CONSTRAINT "Articulo_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "Unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Articulo" ADD CONSTRAINT "Articulo_rubroId_fkey" FOREIGN KEY ("rubroId") REFERENCES "Rubro"("id") ON DELETE SET NULL ON UPDATE CASCADE;
