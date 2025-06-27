/*
  Warnings:

  - A unique constraint covering the columns `[userId,typeId,brandId]` on the table `UserRole` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `brandId` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `userrole` DROP FOREIGN KEY `UserRole_userId_fkey`;

-- DropIndex
DROP INDEX `UserRole_userId_typeId_key` ON `userrole`;

-- AlterTable
ALTER TABLE `task` ADD COLUMN `brandId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `userrole` ADD COLUMN `brandId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Brand` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `clickupListId` VARCHAR(191) NOT NULL,
    `clickupSpaceId` VARCHAR(191) NULL,
    `clickupFolderId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `description` VARCHAR(191) NULL,
    `defaultStatus` ENUM('TO_DO', 'IN_PROGRESS', 'ON_APPROVAL', 'COMPLETE') NOT NULL DEFAULT 'TO_DO',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Brand_name_key`(`name`),
    UNIQUE INDEX `Brand_clickupListId_key`(`clickupListId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `UserRole_userId_typeId_brandId_key` ON `UserRole`(`userId`, `typeId`, `brandId`);

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
