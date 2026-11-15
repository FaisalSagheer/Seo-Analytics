-- CreateTable
CREATE TABLE `linkimport` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `asOf` DATE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` VARCHAR(191) NULL,

    INDEX `LinkImport_projectId_asOf_idx`(`projectId`, `asOf`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `linkimportrow` (
    `id` VARCHAR(191) NOT NULL,
    `importId` VARCHAR(191) NOT NULL,
    `kind` ENUM('SITE', 'PAGE', 'TEXT') NOT NULL,
    `label` VARCHAR(2048) NOT NULL,
    `links` INTEGER NOT NULL,
    `related` INTEGER NULL,

    INDEX `LinkImportRow_importId_kind_idx`(`importId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `linkimport` ADD CONSTRAINT `LinkImport_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `linkimport` ADD CONSTRAINT `LinkImport_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `linkimportrow` ADD CONSTRAINT `LinkImportRow_importId_fkey` FOREIGN KEY (`importId`) REFERENCES `linkimport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
