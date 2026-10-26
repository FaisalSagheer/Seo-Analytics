-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    `image` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session` (
    `id` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `userId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `session_token_key`(`token`),
    INDEX `session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `accessToken` TEXT NULL,
    `refreshToken` TEXT NULL,
    `idToken` TEXT NULL,
    `accessTokenExpiresAt` DATETIME(3) NULL,
    `refreshTokenExpiresAt` DATETIME(3) NULL,
    `scope` TEXT NULL,
    `password` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `account_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verification` (
    `id` VARCHAR(191) NOT NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `verification_identifier_idx`(`identifier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `domain` VARCHAR(191) NOT NULL,
    `locationCode` INTEGER NOT NULL DEFAULT 2840,
    `languageCode` VARCHAR(191) NOT NULL DEFAULT 'en',
    `device` ENUM('DESKTOP', 'MOBILE') NOT NULL DEFAULT 'DESKTOP',
    `gscSiteUrl` VARCHAR(191) NULL,
    `ga4PropertyId` VARCHAR(191) NULL,
    `bingSiteUrl` VARCHAR(191) NULL,
    `backlinksDataForSeo` BOOLEAN NOT NULL DEFAULT true,
    `backlinksBing` BOOLEAN NOT NULL DEFAULT true,
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `lastSyncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Project_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `keyword` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `phrase` VARCHAR(700) NOT NULL,
    `tags` VARCHAR(191) NOT NULL DEFAULT '',
    `searchVolume` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Keyword_projectId_idx`(`projectId`),
    UNIQUE INDEX `Keyword_projectId_phrase_key`(`projectId`, `phrase`(191)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ranksnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `keywordId` VARCHAR(191) NOT NULL,
    `checkedAt` DATE NOT NULL,
    `position` INTEGER NULL,
    `url` VARCHAR(2048) NULL,
    `source` ENUM('DATAFORSEO', 'SERPER', 'BING', 'DEMO') NOT NULL DEFAULT 'DATAFORSEO',

    INDEX `RankSnapshot_checkedAt_idx`(`checkedAt`),
    UNIQUE INDEX `RankSnapshot_keywordId_checkedAt_key`(`keywordId`, `checkedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `searchconsoledaily` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `clicks` INTEGER NOT NULL,
    `impressions` INTEGER NOT NULL,
    `ctr` DOUBLE NOT NULL,
    `position` DOUBLE NOT NULL,

    UNIQUE INDEX `SearchConsoleDaily_projectId_date_key`(`projectId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `searchconsolequery` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `query` VARCHAR(700) NOT NULL,
    `clicks` INTEGER NOT NULL,
    `impressions` INTEGER NOT NULL,
    `ctr` DOUBLE NOT NULL,
    `position` DOUBLE NOT NULL,
    `syncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SearchConsoleQuery_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `analyticsdaily` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `sessions` INTEGER NOT NULL,
    `users` INTEGER NOT NULL,
    `conversions` INTEGER NOT NULL,
    `engagementRate` DOUBLE NOT NULL,

    UNIQUE INDEX `AnalyticsDaily_projectId_date_key`(`projectId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `domainsnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `capturedAt` DATE NOT NULL,
    `organicKeywords` INTEGER NULL,
    `organicTraffic` DOUBLE NULL,
    `trafficCost` DOUBLE NULL,
    `pos1` INTEGER NULL,
    `pos2to3` INTEGER NULL,
    `pos4to10` INTEGER NULL,
    `backlinks` INTEGER NULL,
    `referringDomains` INTEGER NULL,
    `domainRank` INTEGER NULL,

    UNIQUE INDEX `DomainSnapshot_projectId_capturedAt_key`(`projectId`, `capturedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `toppage` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `traffic` DOUBLE NOT NULL,
    `keywords` INTEGER NOT NULL,
    `pos1` INTEGER NOT NULL,
    `syncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TopPage_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `backlinksnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `capturedAt` DATE NOT NULL,
    `source` ENUM('DATAFORSEO', 'SERPER', 'BING', 'DEMO') NOT NULL,
    `backlinks` INTEGER NOT NULL,
    `referringDomains` INTEGER NOT NULL,
    `domainRank` INTEGER NULL,

    UNIQUE INDEX `BacklinkSnapshot_projectId_capturedAt_source_key`(`projectId`, `capturedAt`, `source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `backlink` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `urlFrom` VARCHAR(2048) NOT NULL,
    `urlTo` VARCHAR(2048) NOT NULL,
    `domainFrom` VARCHAR(191) NOT NULL,
    `anchor` TEXT NOT NULL,
    `dofollow` BOOLEAN NULL,
    `domainFromRank` INTEGER NULL,
    `firstSeen` DATETIME(3) NULL,
    `lastSeen` DATETIME(3) NULL,
    `isNew` BOOLEAN NOT NULL DEFAULT false,
    `isLost` BOOLEAN NOT NULL DEFAULT false,
    `source` ENUM('DATAFORSEO', 'SERPER', 'BING', 'DEMO') NOT NULL DEFAULT 'DATAFORSEO',

    INDEX `Backlink_projectId_source_idx`(`projectId`, `source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `providercredential` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `provider` ENUM('DATAFORSEO', 'SERPER', 'BING') NOT NULL,
    `login` VARCHAR(191) NOT NULL,
    `secretEncrypted` TEXT NOT NULL,
    `rankDepth` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProviderCredential_userId_provider_key`(`userId`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `providercache` (
    `key` VARCHAR(64) NOT NULL,
    `payload` JSON NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `ProviderCache_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `apikey` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `prefix` VARCHAR(191) NOT NULL,
    `hashedKey` VARCHAR(64) NOT NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ApiKey_hashedKey_key`(`hashedKey`),
    INDEX `ApiKey_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `session` ADD CONSTRAINT `session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account` ADD CONSTRAINT `account_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project` ADD CONSTRAINT `Project_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `keyword` ADD CONSTRAINT `Keyword_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ranksnapshot` ADD CONSTRAINT `RankSnapshot_keywordId_fkey` FOREIGN KEY (`keywordId`) REFERENCES `keyword`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `searchconsoledaily` ADD CONSTRAINT `SearchConsoleDaily_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `searchconsolequery` ADD CONSTRAINT `SearchConsoleQuery_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `analyticsdaily` ADD CONSTRAINT `AnalyticsDaily_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `domainsnapshot` ADD CONSTRAINT `DomainSnapshot_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `toppage` ADD CONSTRAINT `TopPage_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `backlinksnapshot` ADD CONSTRAINT `BacklinkSnapshot_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `backlink` ADD CONSTRAINT `Backlink_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `providercredential` ADD CONSTRAINT `ProviderCredential_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apikey` ADD CONSTRAINT `ApiKey_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

