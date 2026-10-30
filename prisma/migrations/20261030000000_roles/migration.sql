-- CreateTable
CREATE TABLE `role` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `description` VARCHAR(255) NOT NULL DEFAULT '',
    `permissions` JSON NOT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `role_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `roleId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `user_roleId_idx` ON `user`(`roleId`);

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `user_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `role`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Built-in roles. Admin's stored permissions are ignored: it always holds everything.
INSERT INTO `role` (`id`, `name`, `description`, `permissions`, `isSystem`, `isDefault`, `updatedAt`) VALUES
    ('role_admin', 'Admin', 'Full access, including team members and roles.', JSON_ARRAY(), true, false, CURRENT_TIMESTAMP(3)),
    ('role_editor', 'Editor', 'Creates and edits projects, keywords and syncs.', JSON_ARRAY('projects.create', 'projects.edit', 'projects.delete', 'keywords.manage', 'data.sync', 'research.use', 'providers.manage', 'apikeys.manage'), false, true, CURRENT_TIMESTAMP(3)),
    ('role_viewer', 'Viewer', 'Read-only access to every project.', JSON_ARRAY(), false, false, CURRENT_TIMESTAMP(3));

-- Existing users keep roughly what they had (Editor); the oldest account becomes the Admin
UPDATE `user` SET `roleId` = 'role_editor';
UPDATE `user` SET `roleId` = 'role_admin' ORDER BY `createdAt` ASC LIMIT 1;
