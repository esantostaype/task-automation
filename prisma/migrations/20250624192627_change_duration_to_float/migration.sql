/*
  Warnings:

  - You are about to alter the column `duration` on the `taskcategory` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(5,2)`.

*/
-- AlterTable
ALTER TABLE `taskcategory` MODIFY `duration` DECIMAL(5, 2) NOT NULL;
