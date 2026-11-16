-- The demo sign-in is public, so its account gets a role that sees only its own demo project,
-- not whatever the default role (Editor) can see.
INSERT INTO `role` (`id`, `name`, `description`, `permissions`, `isSystem`, `isDefault`, `seeAllProjects`, `updatedAt`) VALUES
    ('role_demo', 'Demo', 'The public demo account: only its own sample project.', JSON_ARRAY('keywords.manage', 'data.sync'), false, false, false, CURRENT_TIMESTAMP(3));
