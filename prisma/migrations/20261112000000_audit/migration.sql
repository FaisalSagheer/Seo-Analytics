-- CreateTable
CREATE TABLE `auditrun` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `status` ENUM('RUNNING', 'DONE', 'FAILED') NOT NULL DEFAULT 'RUNNING',
    `startUrl` VARCHAR(2048) NOT NULL,
    `pagesCrawled` INTEGER NOT NULL DEFAULT 0,
    `score` INTEGER NULL,
    `siteIssues` JSON NULL,
    `error` VARCHAR(500) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,

    INDEX `AuditRun_projectId_startedAt_idx`(`projectId`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auditpage` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `statusCode` INTEGER NOT NULL,
    `title` VARCHAR(1000) NULL,
    `metaDescription` VARCHAR(2000) NULL,
    `h1` VARCHAR(1000) NULL,
    `h1Count` INTEGER NOT NULL DEFAULT 0,
    `canonical` VARCHAR(2048) NULL,
    `wordCount` INTEGER NOT NULL DEFAULT 0,
    `loadMs` INTEGER NOT NULL DEFAULT 0,
    `internalLinks` INTEGER NOT NULL DEFAULT 0,
    `externalLinks` INTEGER NOT NULL DEFAULT 0,
    `issues` JSON NOT NULL,

    INDEX `AuditPage_runId_idx`(`runId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `auditrun` ADD CONSTRAINT `AuditRun_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auditpage` ADD CONSTRAINT `AuditPage_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `auditrun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
