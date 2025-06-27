/*
  Warnings:

  - You are about to drop the column `entityId` on the `synclog` table. All the data in the column will be lost.
  - The primary key for the `task` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `clickupId` on the `task` table. All the data in the column will be lost.
  - You are about to drop the column `clickupUrl` on the `task` table. All the data in the column will be lost.
  - The primary key for the `user` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `available` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `clickupEmail` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `clickupId` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `isClickupActive` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `ratio` on the `userrole` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[id]` on the table `Task` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `taskassignment` DROP FOREIGN KEY `TaskAssignment_taskId_fkey`;

-- DropForeignKey
ALTER TABLE `taskassignment` DROP FOREIGN KEY `TaskAssignment_userId_fkey`;

-- DropForeignKey
ALTER TABLE `userrole` DROP FOREIGN KEY `UserRole_userId_fkey`;

-- DropIndex
DROP INDEX `Task_clickupId_key` ON `task`;

-- DropIndex
DROP INDEX `TaskAssignment_taskId_fkey` ON `taskassignment`;

-- DropIndex
DROP INDEX `User_clickupId_key` ON `user`;

-- AlterTable
ALTER TABLE `synclog` DROP COLUMN `entityId`,
    ADD COLUMN `entityIntId` INTEGER NULL,
    ADD COLUMN `entityStringId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `task` DROP PRIMARY KEY,
    DROP COLUMN `clickupId`,
    DROP COLUMN `clickupUrl`,
    ADD COLUMN `url` VARCHAR(191) NULL,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `taskassignment` MODIFY `userId` VARCHAR(191) NOT NULL,
    MODIFY `taskId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `user` DROP PRIMARY KEY,
    DROP COLUMN `available`,
    DROP COLUMN `clickupEmail`,
    DROP COLUMN `clickupId`,
    DROP COLUMN `isClickupActive`,
    ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `userrole` DROP COLUMN `ratio`,
    MODIFY `userId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Task_id_key` ON `Task`(`id`);

-- CreateIndex
CREATE UNIQUE INDEX `User_id_key` ON `User`(`id`);

-- AddForeignKey
ALTER TABLE `TaskAssignment` ADD CONSTRAINT `TaskAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskAssignment` ADD CONSTRAINT `TaskAssignment_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
