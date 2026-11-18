-- Marca de la copia automática del resumen de tarjeta al mes siguiente (cron diario).
-- Aditiva y nullable: el código viejo la ignora.
ALTER TABLE "TarjetaCierre" ADD COLUMN "autoCopiadoAt" TIMESTAMP(3);
