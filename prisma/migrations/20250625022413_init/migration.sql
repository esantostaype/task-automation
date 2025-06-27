/*
  Warnings:

  - You are about to drop the column `clickupTaskId` on the `task` table. All the data in the column will be lost.
  - You are about to drop the column `designerId` on the `task` table. All the data in the column will be lost.
  - You are about to drop the `designer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `designerrole` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `designerrole` DROP FOREIGN KEY `DesignerRole_designerId_fkey`;

-- DropForeignKey
ALTER TABLE `designerrole` DROP FOREIGN KEY `DesignerRole_typeId_fkey`;

-- DropForeignKey
ALTER TABLE `task` DROP FOREIGN KEY `Task_designerId_fkey`;

-- DropIndex
DROP INDEX `Task_designerId_fkey` ON `task`;

-- AlterTable
ALTER TABLE `task` DROP COLUMN `clickupTaskId`,
    DROP COLUMN `designerId`,
    ADD COLUMN `clickupId` VARCHAR(191) NULL,
    ADD COLUMN `description` VARCHAR(191) NULL,
    ADD COLUMN `points` INTEGER NULL,
    ADD COLUMN `tags` VARCHAR(191) NULL,
    ADD COLUMN `timeEstimate` INTEGER NULL;

-- DropTable
DROP TABLE `designer`;

-- DropTable
DROP TABLE `designerrole`;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `available` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `taskId` INTEGER NOT NULL,

    UNIQUE INDEX `TaskAssignment_userId_taskId_key`(`userId`, `taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRole` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `typeId` INTEGER NOT NULL,
    `ratio` DOUBLE NOT NULL DEFAULT 1.0,

    UNIQUE INDEX `UserRole_userId_typeId_key`(`userId`, `typeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TaskAssignment` ADD CONSTRAINT `TaskAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskAssignment` ADD CONSTRAINT `TaskAssignment_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `TaskType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
