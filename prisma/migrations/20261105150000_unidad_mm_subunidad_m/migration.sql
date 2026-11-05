-- mm es la milésima parte del metro, como g del kg y ml del litro: las cantidades se registran
-- en mm y en pantalla se pueden cargar y ver en metros (y el precio por metro).
-- Sólo datos: la columna "subunidadDe" ya existe (es texto, no enum).
UPDATE "Unidad" SET "subunidadDe" = 'm' WHERE lower("nombre") IN ('mm', 'milimetro', 'milimetros') AND "subunidadDe" IS NULL;
