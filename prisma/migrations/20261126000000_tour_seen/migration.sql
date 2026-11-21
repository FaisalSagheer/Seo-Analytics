-- AlterTable: when a user finished or skipped the first-login tour
ALTER TABLE `user` ADD COLUMN `tourSeenAt` DATETIME(3) NULL;
