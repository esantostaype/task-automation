/*
  Warnings:

  - You are about to alter the column `priority` on the `task` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(0))`.

*/
-- DropForeignKey
ALTER TABLE `task` DROP FOREIGN KEY `Task_categoryId_fkey`;

-- DropForeignKey
ALTER TABLE `task` DROP FOREIGN KEY `Task_designerId_fkey`;

-- DropForeignKey
ALTER TABLE `task` DROP FOREIGN KEY `Task_typeId_fkey`;

-- DropIndex
DROP INDEX `Task_categoryId_fkey` ON `task`;

-- DropIndex
DROP INDEX `Task_designerId_fkey` ON `task`;

-- DropIndex
DROP INDEX `Task_typeId_fkey` ON `task`;

-- AlterTable
ALTER TABLE `task` MODIFY `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_designerId_fkey` FOREIGN KEY (`designerId`) REFERENCES `Designer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `TaskType`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `TaskCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
