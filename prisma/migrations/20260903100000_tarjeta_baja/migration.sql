-- Baja de una tarjeta por período. La tarjeta que ya no se posee seguía apareciendo en /gastos
-- para siempre (fila de cierres, selects de carga, filtro), y borrarla no era salida: la FK
-- `Gasto.tarjetaId` cascadea, así que borrar la tarjeta se lleva los gastos que la usaron y con
-- ellos el histórico de dónde se gastó.
--
-- La baja es entonces un corte temporal: desde `(bajaMes, bajaAnio)` **inclusive** la tarjeta
-- deja de ofrecerse y de mostrarse en /gastos, y los meses anteriores no cambian en nada.
-- /reportes y /configuracion la siguen viendo siempre (en configuración es donde se revierte).
--
-- Los dos nullable y sin backfill: `null` en ambos = activa, que es el estado de todo lo ya
-- cargado. Se guarda el par mes/año y no una fecha porque el corte es por período de gasto,
-- igual que `Gasto.mes`/`Gasto.anio` — no por el día exacto en que se cerró la cuenta. El par
-- se interpreta como todo-o-nada (ver src/lib/tarjetas-baja.ts): uno solo de los dos no
-- esconde la tarjeta, así que un dato a medias no la hace desaparecer.

-- AlterTable
ALTER TABLE "Tarjeta" ADD COLUMN "bajaMes" INTEGER;
ALTER TABLE "Tarjeta" ADD COLUMN "bajaAnio" INTEGER;
