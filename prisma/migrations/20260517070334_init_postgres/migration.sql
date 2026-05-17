-- CreateTable
CREATE TABLE "Moneda" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "simbolo" TEXT NOT NULL,

    CONSTRAINT "Moneda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Casa" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Casa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarjeta" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "banco" TEXT,

    CONSTRAINT "Tarjeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lugar" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Lugar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gasto" (
    "id" SERIAL NOT NULL,
    "casaId" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fechaVencimiento" TEXT NOT NULL,
    "tipoPago" TEXT NOT NULL,
    "monedaId" INTEGER NOT NULL,
    "tipoCambio" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "totalMoneda" DOUBLE PRECISION NOT NULL,
    "totalPagado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pasajeMesSiguiente" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prestamo_a_otro" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tarjetaId" INTEGER,
    "lugarId" INTEGER,
    "cuotaActual" INTEGER,
    "cuotasTotales" INTEGER,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "notas" TEXT,
    "confirmado" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GastoItem" (
    "id" SERIAL NOT NULL,
    "gastoId" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "fecha" TEXT,
    "cuotaActual" INTEGER,
    "cuotasTotales" INTEGER,
    "incluyeEnTotal" BOOLEAN NOT NULL DEFAULT true,
    "incluyeEnVencimiento" BOOLEAN NOT NULL DEFAULT false,
    "lugarId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GastoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inversion" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimiento" (
    "id" SERIAL NOT NULL,
    "inversionId" INTEGER NOT NULL,
    "fecha" TEXT NOT NULL,
    "montoActual" DOUBLE PRECISION NOT NULL,
    "montoExtra" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" SERIAL NOT NULL,
    "gastoId" INTEGER NOT NULL,
    "fecha" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Moneda_codigo_key" ON "Moneda"("codigo");

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_casaId_fkey" FOREIGN KEY ("casaId") REFERENCES "Casa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "Moneda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_tarjetaId_fkey" FOREIGN KEY ("tarjetaId") REFERENCES "Tarjeta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_lugarId_fkey" FOREIGN KEY ("lugarId") REFERENCES "Lugar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoItem" ADD CONSTRAINT "GastoItem_gastoId_fkey" FOREIGN KEY ("gastoId") REFERENCES "Gasto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoItem" ADD CONSTRAINT "GastoItem_lugarId_fkey" FOREIGN KEY ("lugarId") REFERENCES "Lugar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_inversionId_fkey" FOREIGN KEY ("inversionId") REFERENCES "Inversion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_gastoId_fkey" FOREIGN KEY ("gastoId") REFERENCES "Gasto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
