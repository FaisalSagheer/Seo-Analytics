-- AlterTable: which per-page tours a user has finished or skipped
ALTER TABLE `user` ADD COLUMN `pageToursSeen` TEXT NULL;
