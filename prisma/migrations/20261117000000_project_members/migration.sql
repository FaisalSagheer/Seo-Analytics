-- AlterTable: existing roles keep seeing every project
ALTER TABLE `role` ADD COLUMN `seeAllProjects` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `projectmember` (
    `projectId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProjectMember_userId_idx`(`userId`),
    PRIMARY KEY (`projectId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Every existing project's owner keeps access to it
INSERT INTO `projectmember` (`projectId`, `userId`, `createdAt`)
SELECT `id`, `userId`, CURRENT_TIMESTAMP(3) FROM `project`;

-- AddForeignKey
ALTER TABLE `projectmember` ADD CONSTRAINT `ProjectMember_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projectmember` ADD CONSTRAINT `ProjectMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
