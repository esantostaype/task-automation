/*
  Warnings:

  - You are about to alter the column `duration` on the `taskcategory` table. The data in that column could be lost. The data in that column will be cast from `Decimal(5,2)` to `Double`.

*/
-- AlterTable
ALTER TABLE `taskcategory` MODIFY `duration` DOUBLE NOT NULL;
