/*
  Warnings:

  - You are about to drop the column `cdaCode` on the `Tecnomecanica` table. All the data in the column will be lost.
  - Made the column `startDate` on table `Tecnomecanica` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Tecnomecanica" DROP COLUMN "cdaCode",
ALTER COLUMN "certificateNumber" DROP NOT NULL,
ALTER COLUMN "startDate" SET NOT NULL;
