-- La inversión pasa a tener moneda. Los montos de sus movimientos eran números pelados:
-- una inversión en USD y otra en ARS se veían igual y no había forma de saber cuál era cuál.
--
-- Es nullable a propósito, y sin backfill: `null` significa "sin moneda declarada" y se
-- muestra como ARS, que es lo que se venía asumiendo. Poner ARS a la fuerza en las que ya
-- existen afirmaría algo que nadie declaró — que todas eran en pesos.
--
-- No hay `tipoCambio` como en `Gasto`/`Ingreso`: una inversión en dólares se sigue en
-- dólares. Convertir a ARS con la cotización de hoy mezclaría la variación del tipo de
-- cambio con el rendimiento real de la inversión.

-- AlterTable
ALTER TABLE "Inversion" ADD COLUMN "monedaId" INTEGER;

-- AddForeignKey
ALTER TABLE "Inversion" ADD CONSTRAINT "Inversion_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "Moneda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
