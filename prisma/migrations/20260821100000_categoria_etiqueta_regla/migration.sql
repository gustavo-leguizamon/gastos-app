-- Corrección manual de qué etiquetas ofrece el form para una categoría.
--
-- La lista base no se guarda: se deriva del histórico (`src/lib/etiquetas-sugeridas.ts`), porque
-- una whitelist completa mantenida a mano obligaría a declarar las etiquetas transversales
-- (`Mercado Libre` está en 10 categorías, `Mercado Pago` en 8) en casi todas las categorías, y la
-- que se olvide termina retipeada como variante del mismo nombre. Esta tabla es sólo la capa de
-- excepciones: la ausencia de fila es el caso normal, y arranca vacía.
--
-- `modo`: 'fijar' = ofrecerla acá aunque el histórico no la respalde; 'excluir' = no ofrecerla
-- nunca acá, ni siquiera si es transversal. Excluir gana sobre fijar y sobre el histórico.
--
-- `onDelete: Cascade` en las dos puntas: una regla sobre una categoría o etiqueta borrada no
-- significa nada, y no cuenta como "uso" que impida borrarlas.

-- CreateTable
CREATE TABLE "CategoriaEtiquetaRegla" (
    "id" SERIAL NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "etiquetaId" INTEGER NOT NULL,
    "modo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoriaEtiquetaRegla_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaEtiquetaRegla_categoriaId_etiquetaId_key" ON "CategoriaEtiquetaRegla"("categoriaId", "etiquetaId");

-- AddForeignKey
ALTER TABLE "CategoriaEtiquetaRegla" ADD CONSTRAINT "CategoriaEtiquetaRegla_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoriaEtiquetaRegla" ADD CONSTRAINT "CategoriaEtiquetaRegla_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "Etiqueta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
