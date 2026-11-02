-- Plataformas donde comprar una divisa, con la cotización de venta y la comisión que cobran,
-- para comparar cuál conviene. Es una tabla de precios (se edita cuando cambian), no un libro
-- de operaciones: lo que cada una entrega por un monto se deriva en divisas-plataformas.ts.

-- CreateTable
CREATE TABLE "PlataformaDivisa" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "monedaId" INTEGER NOT NULL,
    "cotizacion" DOUBLE PRECISION NOT NULL,
    "comisionTipo" TEXT NOT NULL DEFAULT 'PORCENTAJE',
    "comision" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "comisionMoneda" TEXT NOT NULL DEFAULT 'ARS',
    "nota" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlataformaDivisa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlataformaDivisa_monedaId_idx" ON "PlataformaDivisa"("monedaId");

-- AddForeignKey
ALTER TABLE "PlataformaDivisa" ADD CONSTRAINT "PlataformaDivisa_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "Moneda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
