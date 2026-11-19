-- CreateTable: which pages rank for each tracked keyword, per day
CREATE TABLE `rankpage` (
    `id` VARCHAR(191) NOT NULL,
    `keywordId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `page` VARCHAR(2048) NOT NULL,
    `position` DOUBLE NOT NULL,
    `impressions` INTEGER NOT NULL,
    `clicks` INTEGER NOT NULL,

    INDEX `RankPage_keywordId_date_idx`(`keywordId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `rankpage` ADD CONSTRAINT `RankPage_keywordId_fkey` FOREIGN KEY (`keywordId`) REFERENCES `keyword`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
