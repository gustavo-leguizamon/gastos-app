-- `Categoria.nombre` y `Etiqueta.nombre` pasan a ser únicos, con la misma garantía que ya
-- tenía `Concepto.nombre`. Hasta acá el alta inline desde los selects del form creaba una
-- fila nueva con el texto crudo, así que "Comida" / "comida " / "Comida  " podían convivir
-- y partir en pedazos el reporte por categoría sin que nada lo señalara.
--
-- El orden importa: normalizar → fusionar duplicados → recién ahí el índice único. Si se
-- creara el índice primero, la migración fallaría en cualquier base que ya tenga duplicados.

-- 1) Normalizar: trim + colapso de espacios internos (misma regla que `normalizeNombre`).
UPDATE "Categoria" SET "nombre" = btrim(regexp_replace("nombre", '\s+', ' ', 'g'));

UPDATE "Etiqueta" SET "nombre" = btrim(regexp_replace("nombre", '\s+', ' ', 'g'));

-- 2) Fusionar duplicados case-insensitive contra el de menor id (el más viejo gana).
--    Categoría: FK única en Gasto y GastoItem, se reapunta.
UPDATE "Gasto" g
SET "categoriaId" = d."keep_id"
FROM (
  SELECT c."id" AS "dup_id", MIN(c2."id") AS "keep_id"
  FROM "Categoria" c
  JOIN "Categoria" c2 ON lower(c2."nombre") = lower(c."nombre")
  GROUP BY c."id"
) d
WHERE g."categoriaId" = d."dup_id" AND d."dup_id" <> d."keep_id";

UPDATE "GastoItem" i
SET "categoriaId" = d."keep_id"
FROM (
  SELECT c."id" AS "dup_id", MIN(c2."id") AS "keep_id"
  FROM "Categoria" c
  JOIN "Categoria" c2 ON lower(c2."nombre") = lower(c."nombre")
  GROUP BY c."id"
) d
WHERE i."categoriaId" = d."dup_id" AND d."dup_id" <> d."keep_id";

DELETE FROM "Categoria" c
WHERE EXISTS (SELECT 1 FROM "Categoria" c2 WHERE lower(c2."nombre") = lower(c."nombre") AND c2."id" < c."id");

--    Etiqueta: M2M. Se reapuntan las filas de las tablas intermedias evitando las que ya
--    apuntan al que se conserva (si no, el PK compuesto de la join table explota), y recién
--    después se borran las sobrantes.
UPDATE "_GastoEtiquetas" j
SET "B" = d."keep_id"
FROM (
  SELECT e."id" AS "dup_id", MIN(e2."id") AS "keep_id"
  FROM "Etiqueta" e
  JOIN "Etiqueta" e2 ON lower(e2."nombre") = lower(e."nombre")
  GROUP BY e."id"
) d
WHERE j."B" = d."dup_id"
  AND d."dup_id" <> d."keep_id"
  AND NOT EXISTS (SELECT 1 FROM "_GastoEtiquetas" j2 WHERE j2."A" = j."A" AND j2."B" = d."keep_id");

UPDATE "_GastoItemEtiquetas" j
SET "B" = d."keep_id"
FROM (
  SELECT e."id" AS "dup_id", MIN(e2."id") AS "keep_id"
  FROM "Etiqueta" e
  JOIN "Etiqueta" e2 ON lower(e2."nombre") = lower(e."nombre")
  GROUP BY e."id"
) d
WHERE j."B" = d."dup_id"
  AND d."dup_id" <> d."keep_id"
  AND NOT EXISTS (SELECT 1 FROM "_GastoItemEtiquetas" j2 WHERE j2."A" = j."A" AND j2."B" = d."keep_id");

DELETE FROM "Etiqueta" e
WHERE EXISTS (SELECT 1 FROM "Etiqueta" e2 WHERE lower(e2."nombre") = lower(e."nombre") AND e2."id" < e."id");

-- 3) Ahora sí, la unicidad. Es case-SENSITIVE a nivel índice (Prisma no soporta índices
--    funcionales sobre lower()); la garantía case-insensitive la aporta `resolveCategoria`
--    /`resolveEtiqueta` en los write paths, igual que con `Concepto`.

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Etiqueta_nombre_key" ON "Etiqueta"("nombre");
