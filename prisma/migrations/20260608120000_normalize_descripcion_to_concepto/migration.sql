-- Normaliza el texto libre `descripcion` a una entidad `Concepto` referenciada por id.
-- Toda la migración corre en una transacción (DDL transaccional en Postgres): si algo falla,
-- no quedan estados intermedios. El backfill deduplica por nombre normalizado case-insensitive
-- (trim + colapso de espacios internos) eligiendo una forma de display determinística.

-- 1. Tabla Concepto
CREATE TABLE "Concepto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Concepto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Concepto_nombre_key" ON "Concepto"("nombre");

-- 2. Columnas FK nullable (se completan en el backfill antes de exigir NOT NULL)
ALTER TABLE "Gasto" ADD COLUMN "conceptoId" INTEGER;
ALTER TABLE "GastoItem" ADD COLUMN "conceptoId" INTEGER;

-- 3. Backfill: un Concepto por cada descripcion normalizada distinta (case-insensitive).
--    DISTINCT ON sobre la clave lower(normalizado); se elige la variante alfabéticamente
--    menor como nombre de display.
INSERT INTO "Concepto" ("nombre", "createdAt")
SELECT DISTINCT ON (lower(regexp_replace(btrim(d), '\s+', ' ', 'g')))
       regexp_replace(btrim(d), '\s+', ' ', 'g') AS nombre,
       CURRENT_TIMESTAMP
FROM (
  SELECT "descripcion" AS d FROM "Gasto"
  UNION ALL
  SELECT "descripcion" AS d FROM "GastoItem"
) src
WHERE d IS NOT NULL AND btrim(d) <> ''
ORDER BY lower(regexp_replace(btrim(d), '\s+', ' ', 'g')),
         regexp_replace(btrim(d), '\s+', ' ', 'g');

-- 4. Asociar cada fila a su concepto por nombre normalizado
UPDATE "Gasto" g
SET "conceptoId" = c."id"
FROM "Concepto" c
WHERE lower(c."nombre") = lower(regexp_replace(btrim(g."descripcion"), '\s+', ' ', 'g'));

UPDATE "GastoItem" i
SET "conceptoId" = c."id"
FROM "Concepto" c
WHERE lower(c."nombre") = lower(regexp_replace(btrim(i."descripcion"), '\s+', ' ', 'g'));

-- 5. Fallback para descripciones vacías/nulas (no deberían existir, pero protege el NOT NULL)
INSERT INTO "Concepto" ("nombre", "createdAt")
SELECT '(sin descripción)', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "Gasto" WHERE "conceptoId" IS NULL)
   OR EXISTS (SELECT 1 FROM "GastoItem" WHERE "conceptoId" IS NULL);

UPDATE "Gasto"
SET "conceptoId" = (SELECT "id" FROM "Concepto" WHERE "nombre" = '(sin descripción)')
WHERE "conceptoId" IS NULL;

UPDATE "GastoItem"
SET "conceptoId" = (SELECT "id" FROM "Concepto" WHERE "nombre" = '(sin descripción)')
WHERE "conceptoId" IS NULL;

-- 6. Exigir NOT NULL + FKs
ALTER TABLE "Gasto" ALTER COLUMN "conceptoId" SET NOT NULL;
ALTER TABLE "GastoItem" ALTER COLUMN "conceptoId" SET NOT NULL;

ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_conceptoId_fkey"
  FOREIGN KEY ("conceptoId") REFERENCES "Concepto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GastoItem" ADD CONSTRAINT "GastoItem_conceptoId_fkey"
  FOREIGN KEY ("conceptoId") REFERENCES "Concepto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. Eliminar la columna de texto libre (irreversible)
ALTER TABLE "Gasto" DROP COLUMN "descripcion";
ALTER TABLE "GastoItem" DROP COLUMN "descripcion";
