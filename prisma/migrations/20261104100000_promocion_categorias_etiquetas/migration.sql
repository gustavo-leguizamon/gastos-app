-- Una promoción, además de conceptos, puede vincularse a categorías y a etiquetas para sugerirse
-- al cargar un gasto y listar candidatos. Tablas puente M2M implícitas de Prisma
-- ("A" = Categoria/Etiqueta, "B" = Promocion, por orden alfabético). Cambio aditivo.

-- CreateTable
CREATE TABLE "_PromocionCategorias" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_PromocionEtiquetas" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_PromocionCategorias_AB_unique" ON "_PromocionCategorias"("A", "B");

-- CreateIndex
CREATE INDEX "_PromocionCategorias_B_index" ON "_PromocionCategorias"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_PromocionEtiquetas_AB_unique" ON "_PromocionEtiquetas"("A", "B");

-- CreateIndex
CREATE INDEX "_PromocionEtiquetas_B_index" ON "_PromocionEtiquetas"("B");

-- AddForeignKey
ALTER TABLE "_PromocionCategorias" ADD CONSTRAINT "_PromocionCategorias_A_fkey" FOREIGN KEY ("A") REFERENCES "Categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PromocionCategorias" ADD CONSTRAINT "_PromocionCategorias_B_fkey" FOREIGN KEY ("B") REFERENCES "Promocion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PromocionEtiquetas" ADD CONSTRAINT "_PromocionEtiquetas_A_fkey" FOREIGN KEY ("A") REFERENCES "Etiqueta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PromocionEtiquetas" ADD CONSTRAINT "_PromocionEtiquetas_B_fkey" FOREIGN KEY ("B") REFERENCES "Promocion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
