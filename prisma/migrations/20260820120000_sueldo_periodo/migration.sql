-- `Sueldo` pasa a tener `mes`/`anio` explícitos, misma convención que `Gasto` e `Ingreso`.
-- Era el único modelo con período que guardaba sólo `fecha`, así que cualquier cruce por
-- período tenía que derivar el mes de un string — justo lo que el resto del schema evita.
-- Además permite imputar a agosto un sueldo cobrado el 31 de julio.
--
-- Las columnas se agregan nullable, se backfillean desde `fecha` y recién después se exige
-- NOT NULL, para no fallar con filas ya cargadas.

-- AlterTable
ALTER TABLE "Sueldo" ADD COLUMN "mes" INTEGER;
ALTER TABLE "Sueldo" ADD COLUMN "anio" INTEGER;

-- Backfill: `fecha` es texto `YYYY-MM-DD`, se parte por posición y no con date functions
-- para no depender del timezone de la sesión.
UPDATE "Sueldo"
SET "anio" = CAST(substring("fecha" FROM 1 FOR 4) AS INTEGER),
    "mes"  = CAST(substring("fecha" FROM 6 FOR 2) AS INTEGER)
WHERE "mes" IS NULL AND "fecha" ~ '^\d{4}-\d{2}-\d{2}$';

-- Red de seguridad para cualquier fila con una `fecha` mal formada: se imputa a enero de
-- 2000, un período obviamente inválido que salta a la vista en la pantalla.
UPDATE "Sueldo" SET "mes" = 1, "anio" = 2000 WHERE "mes" IS NULL;

ALTER TABLE "Sueldo" ALTER COLUMN "mes" SET NOT NULL;
ALTER TABLE "Sueldo" ALTER COLUMN "anio" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Sueldo_anio_mes_idx" ON "Sueldo"("anio", "mes");
