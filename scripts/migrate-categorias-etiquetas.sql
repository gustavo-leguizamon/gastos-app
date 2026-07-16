-- Migración: categorías M2M → categoría única (partición) + etiquetas (M2M transversal).
-- Camino B: la tabla `Categoria` actual (con sus 34 nombres) se conserva y pasa a ser la
-- lista de CATEGORÍAS ÚNICAS (options), con `categoriaId` arrancando VACÍO en todos los
-- gastos/ítems. Sus asignaciones M2M se copian a una nueva tabla `Etiqueta` (tags), sin pérdida.
--
-- Prisma implicit M2M: tabla `_<Relacion>`, columnas A/B por orden alfabético del modelo.
--   GastoEtiquetas      → Etiqueta < Gasto      → A = Etiqueta.id, B = Gasto.id
--   GastoItemEtiquetas  → Etiqueta < GastoItem  → A = Etiqueta.id, B = GastoItem.id
-- Como Etiqueta.id = Categoria.id (copiamos ids), el copy de las join tables es directo.
--
-- Ejecutar UNA sola vez contra la DB, con el dev server detenido. Es idempotente por los
-- guards IF NOT EXISTS / ON CONFLICT donde aplica, pero pensado para correrse una vez.

BEGIN;

-- 1) Etiqueta = copia exacta de Categoria (mismos ids y nombres).
CREATE TABLE IF NOT EXISTS "Etiqueta" (
  "id"     SERIAL PRIMARY KEY,
  "nombre" TEXT NOT NULL
);
INSERT INTO "Etiqueta" ("id", "nombre")
  SELECT "id", "nombre" FROM "Categoria"
  ON CONFLICT ("id") DO NOTHING;
-- Alinear la secuencia de ids al máximo copiado.
SELECT setval(pg_get_serial_sequence('"Etiqueta"', 'id'), COALESCE((SELECT MAX("id") FROM "Etiqueta"), 1));

-- 2) Join tables de Etiqueta, copiando las asignaciones del M2M viejo.
CREATE TABLE IF NOT EXISTS "_GastoEtiquetas" (
  "A" INTEGER NOT NULL REFERENCES "Etiqueta"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "B" INTEGER NOT NULL REFERENCES "Gasto"("id")    ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "_GastoEtiquetas" ("A", "B")
  SELECT "A", "B" FROM "_GastoCategorias";
CREATE UNIQUE INDEX IF NOT EXISTS "_GastoEtiquetas_AB_unique" ON "_GastoEtiquetas"("A", "B");
CREATE INDEX IF NOT EXISTS "_GastoEtiquetas_B_index" ON "_GastoEtiquetas"("B");

CREATE TABLE IF NOT EXISTS "_GastoItemEtiquetas" (
  "A" INTEGER NOT NULL REFERENCES "Etiqueta"("id")  ON DELETE CASCADE ON UPDATE CASCADE,
  "B" INTEGER NOT NULL REFERENCES "GastoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "_GastoItemEtiquetas" ("A", "B")
  SELECT "A", "B" FROM "_GastoItemCategorias";
CREATE UNIQUE INDEX IF NOT EXISTS "_GastoItemEtiquetas_AB_unique" ON "_GastoItemEtiquetas"("A", "B");
CREATE INDEX IF NOT EXISTS "_GastoItemEtiquetas_B_index" ON "_GastoItemEtiquetas"("B");

-- 3) Columna de categoría única (nullable, VACÍA), FK a la tabla Categoria reutilizada.
ALTER TABLE "Gasto"     ADD COLUMN IF NOT EXISTS "categoriaId" INTEGER;
ALTER TABLE "GastoItem" ADD COLUMN IF NOT EXISTS "categoriaId" INTEGER;
ALTER TABLE "Gasto"     ADD CONSTRAINT "Gasto_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GastoItem" ADD CONSTRAINT "GastoItem_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Drop de las join tables viejas (los datos ya viven en las de Etiqueta).
DROP TABLE IF EXISTS "_GastoCategorias";
DROP TABLE IF EXISTS "_GastoItemCategorias";

COMMIT;

-- Verificación sugerida (fuera de la transacción):
--   SELECT (SELECT count(*) FROM "Categoria") AS categorias,
--          (SELECT count(*) FROM "Etiqueta")  AS etiquetas,
--          (SELECT count(*) FROM "_GastoEtiquetas") AS gasto_etiquetas,
--          (SELECT count(*) FROM "_GastoItemEtiquetas") AS item_etiquetas;
-- Luego `npx prisma db push` debería reportar la DB en sync con el schema (o ajustes menores de índices).
