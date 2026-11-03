-- Lista de compras mensual: catálogo de artículos habituales + cantidades y precios por mes.

-- CreateTable
CREATE TABLE "Articulo" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT NOT NULL DEFAULT 'un',
    "rubro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Articulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListaCompraItem" (
    "id" SERIAL NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "precioUnitario" DOUBLE PRECISION,
    "comprado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListaCompraItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListaCompraItem_anio_mes_idx" ON "ListaCompraItem"("anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "ListaCompraItem_articuloId_mes_anio_key" ON "ListaCompraItem"("articuloId", "mes", "anio");

-- AddForeignKey
ALTER TABLE "ListaCompraItem" ADD CONSTRAINT "ListaCompraItem_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
