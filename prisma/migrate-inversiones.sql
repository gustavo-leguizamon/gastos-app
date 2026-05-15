PRAGMA foreign_keys = OFF;

ALTER TABLE "Inversion" RENAME TO "Movimiento_old";

CREATE TABLE "Inversion" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "nombre" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "Inversion" ("nombre") VALUES ('General');

CREATE TABLE "Movimiento" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "inversionId" INTEGER NOT NULL,
  "fecha" TEXT NOT NULL,
  "montoActual" REAL NOT NULL,
  "montoExtra" REAL NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Movimiento_inversionId_fkey" FOREIGN KEY ("inversionId") REFERENCES "Inversion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "Movimiento" ("id", "inversionId", "fecha", "montoActual", "montoExtra", "createdAt")
  SELECT "id", 1, "fecha", "montoActual", "montoExtra", "createdAt" FROM "Movimiento_old";

DROP TABLE "Movimiento_old";

PRAGMA foreign_keys = ON;
