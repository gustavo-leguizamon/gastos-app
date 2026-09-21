-- Registro de compra/venta de divisas (dólares) con su cotización y comisión.
--
-- Hasta ahora no había dónde anotarlo: `Gasto`/`Ingreso` tienen moneda y tipo de cambio, pero
-- comprar dólares no es consumo ni una venta es plata nueva — meterlo ahí inflaría el gasto
-- del mes, rompería el presupuesto por categoría y el estimado del próximo mes proyectaría
-- compras de dólares como si fueran la factura de luz. `Inversion` tampoco sirve: es
-- snapshot-based y a propósito no convierte a ARS, y acá la variación del tipo de cambio es
-- justamente lo que se quiere medir.
--
-- `OperacionDivisa` es un libro de flujo: cada fila es lo que el usuario tipea (fecha, tipo,
-- cantidad, cotización, comisión). La tenencia, el costo en pesos y el resultado NO se
-- persisten — se derivan recorriendo las operaciones en orden (src/lib/divisas-compute.ts).
-- Un saldo guardado se desincroniza del detalle en cuanto se corrige una operación vieja.
--
-- `cantidad` es siempre positiva y el signo lo da `tipo`; `cotizacion` es nullable porque un
-- 'rendimiento' (dólares generados por una inversión) no tuvo precio de compra.
-- `comisionMoneda` existe porque el broker cobra en pesos en la compra y en dólares en la
-- venta o en cripto: sin saber de qué lado se descuenta, ni la tenencia ni el costo cierran.

-- CreateTable
CREATE TABLE "OperacionDivisa" (
    "id" SERIAL NOT NULL,
    "fecha" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "monedaId" INTEGER NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "cotizacion" DOUBLE PRECISION,
    "comision" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "comisionMoneda" TEXT NOT NULL DEFAULT 'ARS',
    "plataforma" TEXT,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperacionDivisa_pkey" PRIMARY KEY ("id")
);

-- La corrida siempre se lee completa y en orden para una divisa.
-- CreateIndex
CREATE INDEX "OperacionDivisa_monedaId_fecha_idx" ON "OperacionDivisa"("monedaId", "fecha");

-- AddForeignKey
ALTER TABLE "OperacionDivisa" ADD CONSTRAINT "OperacionDivisa_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "Moneda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cotización de referencia con la que se valúa la tenencia. Se guarda el histórico y no sólo
-- el último valor porque sin él no hay curva: el valor en pesos de la posición sólo se puede
-- dibujar si se sabe a cuánto cotizaba en cada momento. Una por (moneda, fecha) — es *la*
-- referencia del día, no un registro de mercado; recargar el mismo día pisa el valor.

-- CreateTable
CREATE TABLE "CotizacionDivisa" (
    "id" SERIAL NOT NULL,
    "monedaId" INTEGER NOT NULL,
    "fecha" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "fuente" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CotizacionDivisa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CotizacionDivisa_monedaId_fecha_key" ON "CotizacionDivisa"("monedaId", "fecha");

-- AddForeignKey
ALTER TABLE "CotizacionDivisa" ADD CONSTRAINT "CotizacionDivisa_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "Moneda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
