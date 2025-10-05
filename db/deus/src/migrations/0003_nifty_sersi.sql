DROP INDEX `user_id_idx` ON `lightfast_deus_connected_repository`;--> statement-breakpoint
DROP INDEX `user_active_idx` ON `lightfast_deus_connected_repository`;--> statement-breakpoint
ALTER TABLE `lightfast_deus_connected_repository` ADD `organization_id` varchar(191) NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_deus_connected_repository` ADD `github_installation_id` varchar(191) NOT NULL;--> statement-breakpoint
CREATE INDEX `org_id_idx` ON `lightfast_deus_connected_repository` (`organization_id`);--> statement-breakpoint
CREATE INDEX `org_active_idx` ON `lightfast_deus_connected_repository` (`organization_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `installation_idx` ON `lightfast_deus_connected_repository` (`github_installation_id`);--> statement-breakpoint
ALTER TABLE `lightfast_deus_connected_repository` DROP COLUMN `user_id`;--> statement-breakpoint
ALTER TABLE `lightfast_deus_connected_repository` DROP COLUMN `installation_id`;--> statement-breakpoint
ALTER TABLE `lightfast_deus_connected_repository` DROP COLUMN `access_token`;