/*
  Warnings:

  - You are about to drop the column `date` on the `HostelBooking` table. All the data in the column will be lost.
  - Added the required column `endDate` to the `HostelBooking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `HostelBooking` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HostelBooking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "adminId" INTEGER NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HostelBooking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HostelBooking_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_HostelBooking" ("adminId", "createdAt", "description", "id", "roomId") SELECT "adminId", "createdAt", "description", "id", "roomId" FROM "HostelBooking";
DROP TABLE "HostelBooking";
ALTER TABLE "new_HostelBooking" RENAME TO "HostelBooking";
CREATE INDEX "HostelBooking_roomId_idx" ON "HostelBooking"("roomId");
CREATE INDEX "HostelBooking_startDate_endDate_idx" ON "HostelBooking"("startDate", "endDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
