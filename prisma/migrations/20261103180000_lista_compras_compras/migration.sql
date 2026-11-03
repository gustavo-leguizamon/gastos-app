-- Compras de una línea de la lista: cada una con su cantidad, su precio y su fecha. El precio de
-- la línea pasa a ser el promedio ponderado por cantidad de sus compras (se recalcula en cada
-- alta/edición/baja), y lo llevado la suma. Las líneas sin compras registradas siguen con el
-- precio y la cantidad cargados a mano, así que esta tabla arranca vacía y no migra datos.

-- CreateTable
CREATE TABLE "ListaCompraCompra" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "precioUnitario" DOUBLE PRECISION,
    "fecha" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListaCompraCompra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListaCompraCompra_itemId_idx" ON "ListaCompraCompra"("itemId");

-- AddForeignKey
ALTER TABLE "ListaCompraCompra" ADD CONSTRAINT "ListaCompraCompra_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ListaCompraItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
