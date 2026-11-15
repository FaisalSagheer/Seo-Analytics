-- CreateTable
CREATE TABLE `referraldaily` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `sessions` INTEGER NOT NULL,
    `users` INTEGER NOT NULL,
    `conversions` INTEGER NOT NULL,

    UNIQUE INDEX `ReferralDaily_projectId_date_source_key`(`projectId`, `date`, `source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `referralpage` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `referrer` VARCHAR(2048) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `sessions` INTEGER NOT NULL,
    `users` INTEGER NOT NULL,
    `syncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReferralPage_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `referraldaily` ADD CONSTRAINT `ReferralDaily_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `referralpage` ADD CONSTRAINT `ReferralPage_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
