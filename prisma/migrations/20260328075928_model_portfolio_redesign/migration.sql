/*
  Warnings:

  - You are about to drop the column `totalAmount` on the `ModelPortfolio` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "ModelTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "price" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "modelPortfolioId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModelTransaction_modelPortfolioId_fkey" FOREIGN KEY ("modelPortfolioId") REFERENCES "ModelPortfolio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ModelAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "percentage" REAL NOT NULL,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "avgPrice" REAL NOT NULL DEFAULT 0,
    "modelPortfolioId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ModelAllocation_modelPortfolioId_fkey" FOREIGN KEY ("modelPortfolioId") REFERENCES "ModelPortfolio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ModelAllocation" ("companyName", "createdAt", "id", "modelPortfolioId", "percentage", "symbol", "updatedAt") SELECT "companyName", "createdAt", "id", "modelPortfolioId", "percentage", "symbol", "updatedAt" FROM "ModelAllocation";
DROP TABLE "ModelAllocation";
ALTER TABLE "new_ModelAllocation" RENAME TO "ModelAllocation";
CREATE UNIQUE INDEX "ModelAllocation_modelPortfolioId_symbol_key" ON "ModelAllocation"("modelPortfolioId", "symbol");
CREATE TABLE "new_ModelPortfolio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "cashBalance" REAL NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ModelPortfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ModelPortfolio" ("createdAt", "description", "id", "name", "updatedAt", "userId") SELECT "createdAt", "description", "id", "name", "updatedAt", "userId" FROM "ModelPortfolio";
DROP TABLE "ModelPortfolio";
ALTER TABLE "new_ModelPortfolio" RENAME TO "ModelPortfolio";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
