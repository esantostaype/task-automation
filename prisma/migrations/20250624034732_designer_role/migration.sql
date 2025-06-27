/*
  Warnings:

  - Made the column `designerId` on table `task` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `task` DROP FOREIGN KEY `Task_designerId_fkey`;

-- DropIndex
DROP INDEX `Task_designerId_fkey` ON `task`;

-- AlterTable
ALTER TABLE `task` MODIFY `designerId` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `DesignerRole` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `designerId` INTEGER NOT NULL,
    `typeId` INTEGER NOT NULL,
    `ratio` DOUBLE NOT NULL DEFAULT 1.0,

    UNIQUE INDEX `DesignerRole_designerId_typeId_key`(`designerId`, `typeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_designerId_fkey` FOREIGN KEY (`designerId`) REFERENCES `Designer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DesignerRole` ADD CONSTRAINT `DesignerRole_designerId_fkey` FOREIGN KEY (`designerId`) REFERENCES `Designer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DesignerRole` ADD CONSTRAINT `DesignerRole_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `TaskType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
