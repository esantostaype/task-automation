/*
  Warnings:

  - The primary key for the `brand` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `clickupFolderId` on the `brand` table. All the data in the column will be lost.
  - You are about to drop the column `clickupListId` on the `brand` table. All the data in the column will be lost.
  - You are about to drop the column `clickupSpaceId` on the `brand` table. All the data in the column will be lost.
  - You are about to drop the column `clickupTeamId` on the `brand` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[id]` on the table `Brand` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `task` DROP FOREIGN KEY `Task_brandId_fkey`;

-- DropForeignKey
ALTER TABLE `userrole` DROP FOREIGN KEY `UserRole_brandId_fkey`;

-- DropIndex
DROP INDEX `Brand_clickupListId_key` ON `brand`;

-- DropIndex
DROP INDEX `Task_brandId_fkey` ON `task`;

-- DropIndex
DROP INDEX `UserRole_brandId_fkey` ON `userrole`;

-- AlterTable
ALTER TABLE `brand` DROP PRIMARY KEY,
    DROP COLUMN `clickupFolderId`,
    DROP COLUMN `clickupListId`,
    DROP COLUMN `clickupSpaceId`,
    DROP COLUMN `clickupTeamId`,
    ADD COLUMN `folderId` VARCHAR(191) NULL,
    ADD COLUMN `spaceId` VARCHAR(191) NULL,
    ADD COLUMN `teamId` VARCHAR(191) NULL,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `task` MODIFY `brandId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `userrole` MODIFY `brandId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Brand_id_key` ON `Brand`(`id`);

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
