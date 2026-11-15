-- CreateTable
CREATE TABLE `projectcredential` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `provider` ENUM('DATAFORSEO', 'SERPER', 'BING') NOT NULL,
    `login` VARCHAR(191) NOT NULL,
    `secretEncrypted` TEXT NOT NULL,
    `rankDepth` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProjectCredential_projectId_provider_key`(`projectId`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `projectcredential` ADD CONSTRAINT `ProjectCredential_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
