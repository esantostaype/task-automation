/*
  Warnings:

  - Added the required column `name` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `task` ADD COLUMN `name` VARCHAR(191) NOT NULL;
